"use client"

import Swap from "@microchain/swap"
import "@microchain/swap/assets/index.css"

export default  function Page() {
  return (
    <div className="w-full h-full p-4">
      <div className='max-w-xl mx-auto'>
        <Swap />
      </div>
    </div>
  );
}
