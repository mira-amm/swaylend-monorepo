mod utils;

use base64::{engine::general_purpose, prelude::Engine};
use clap::{builder::Str, Parser};
use fuels::{
    accounts::{provider::Provider, wallet::WalletUnlocked},
    crypto::SecretKey,
    programs::calls::CallParameters,
    types::{bech32::Bech32ContractId, AssetId, Bits256, Bytes, ContractId},
};
use market::{
    abigen_bindings::market_contract_mod::pyth_interface::data_structures::price, PriceDataUpdate,
};
use pyth_sdk::pyth_utils::PythOracleContract;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use utils::{
    get_market_instance, get_yes_no_input, read_env, read_market_config, verify_connected_network,
    Args, Network,
};

#[derive(Parser, Debug)]
pub struct ArgsExtended {
    #[clap(flatten)]
    pub args: Args,
    #[arg(long, required = true)]
    pub config_path: String,
}

#[derive(Serialize)]
struct QueryParams {
    ids: Vec<String>,
    // Add other query parameters as needed
}

#[derive(Serialize, Deserialize)]
struct BinaryData {
    encoding: String,
    data: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct Price {
    price: String,
    publish_time: u64,
    conf: String,
    expo: i64,
}

#[derive(Serialize, Deserialize)]
struct ParsedPriceData {
    id: String,
    price: Price,
    ema_price: serde_json::Value,
    metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
struct PriceFeedData {
    binary: BinaryData,
    parsed: Vec<ParsedPriceData>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("WITHDRAW COLLATERAL ASSETS");

    read_env();

    let args = ArgsExtended::parse();

    let provider = Provider::connect(&args.args.provider_url).await.unwrap();

    let secret = SecretKey::from_str(&args.args.signing_key).unwrap();
    let wallet = WalletUnlocked::new_from_private_key(secret, Some(provider));

    let (market_instance, market_contract_id) = get_market_instance(
        &wallet,
        args.args.proxy_contract_id,
        args.args.target_contract_id,
    )
    .await?;

    let price_feed_ids = vec![
        "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
        "0x06c217a791f5c4f988b36629af4cb88fad827b2485400a358f3b02886b54de92",
        "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
        "0x710659c5a68e2416ce4264ca8d50d34acc20041d91289110eea152c52ff3dc39",
        "0x9ee4e7c60b940440a261eb54b6d8149c23b580ed7da3139f7f08f4ea29dad395",
        "0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784",
    ];

    // Create a client
    let client = reqwest::Client::new();

    let mut url = Url::parse("https://hermes.pyth.network/v2/updates/price/latest").unwrap();

    {
        let mut pairs = url.query_pairs_mut();
        for id in &price_feed_ids {
            pairs.append_pair("ids[]", id);
        }
    }

    // Make GET request
    let response = client.get(url.as_str()).send().await?;

    if response.status().is_success() {
        let body = response.text().await?;
        let json: PriceFeedData = serde_json::from_str(&body)?;

        let publish_times = json
            .parsed
            .iter()
            .map(|v| tai64::Tai64::from_unix(v.price.publish_time.try_into().unwrap()).0)
            .collect::<Vec<u64>>();

        let price_feed_ids_bits256 = price_feed_ids
            .iter()
            .map(|id| Bits256::from_hex_str(id).unwrap())
            .collect::<Vec<Bits256>>();

        let bytes_data: Bytes = Bytes(hex::decode(&json.binary.data[0]).unwrap().to_owned());

        let price_update_data = PriceDataUpdate {
            update_fee: 7,
            publish_times,
            price_feed_ids: price_feed_ids_bits256,
            update_data: Vec::from([bytes_data]),
        };

        // let amount = (0.001 * 1_000_000_000f64) as u64; // ETH HAS 9 DECIMALS
        let amount = (0.001 * 1_000_000f64) as u64; // USDT HAS 6 DECIMALS

        let oracle = PythOracleContract::new(
            if args.args.network == Network::Mainnet {
                ContractId::from_str(
                    "0x1c86fdd9e0e7bc0d2ae1bf6817ef4834ffa7247655701ee1b031b52a24c523da",
                )
                .unwrap()
            } else {
                ContractId::from_str(
                    "0x25146735b29d4216639f7f8b1d7b921ff87a1d3051de62d6cceaacabeb33b8e7",
                )
                .unwrap()
            },
            wallet.clone(),
        );

        let oracle_id = oracle.contract_id();

        let call_params = CallParameters::default().with_amount(7);

        let res = market_instance
            .methods()
            .withdraw_collateral(
                AssetId::from_str(
                    // "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07", // MAINNET ETH
                    "0xf30eade9911f75e819deff8fa76f7cf54c477180c756f5a9c3db6fe1986fe485", // TESTNET USDT
                )
                .unwrap(),
                amount,
                price_update_data,
            )
            .with_contracts(&[&oracle])
            .with_contract_ids(&[oracle_id.clone(), market_contract_id])
            .call_params(call_params)
            .unwrap()
            .call()
            .await?;

        for result in res.decode_logs().results {
            println!("Log: {:?}", result);
        }

        for receipt in res.receipts {
            println!("Receipt: {:?}", receipt);
        }
    } else {
        println!("Request failed with status: {}", response.status());
    }

    Ok(())
}
