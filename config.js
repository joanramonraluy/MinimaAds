// MVP: fee enforcement disabled. Set PLATFORM_KEY to '0x...' wallet address before mainnet.
var PLATFORM_KEY = null;
var APP_NAME = 'minima-ads';

// Maxima public key (DER format, 0x...) of the platform creator that owns the
// built-in viewer Frame. Shipped in config.js so the value is identical on every
// node — the built-in Frame's publisher-side rewards are attributed to this key,
// regardless of which node served the impression. Custom Frames are owned by the
// publisher that registers them; only the built-in Frame belongs to the platform.
// Loaded in BOTH runtimes (SW via MDS.load, FE via <script>) so it resolves as a
// global in core/* and dapp/views/*.
var MINIMAADS_CREATOR_PK = '0X30819F300D06092A864886F70D010101050003818D0030818902818100AD837E35B66F797A492A2D527A5AF7B1B9D4D7A0BA982010916370D377CF8F1929B15645E087E9624542BABEDDDB38D4BA60C378E00BC4B860A6C08AC12BF3DF95AB30A3E7A33C1E5194903E6BE7E6AACB4EC93A79F49460C0B93A59B3E286D11E463E078E79236F2C06AB5B48105AE6FD65A6102B663895679C5542DFAD5A550203010001';
