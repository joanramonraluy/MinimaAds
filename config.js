// MVP: fee enforcement disabled. Set PLATFORM_KEY to '0x...' wallet address before mainnet.
var PLATFORM_KEY = null;
// MVP: Minima Foundation fee disabled. Set FOUNDATION_KEY to '0x...' wallet address before mainnet.
var FOUNDATION_KEY = null;
var APP_NAME = 'minima-ads';

// Maxima public key (DER format, 0x...) of the platform creator that owns the
// built-in viewer Frame. Shipped in config.js so the value is identical on every
// node — the built-in Frame's publisher-side rewards are attributed to this key,
// regardless of which node served the impression. Custom Frames are owned by the
// publisher that registers them; only the built-in Frame belongs to the platform.
// Loaded in BOTH runtimes (SW via MDS.load, FE via <script>) so it resolves as a
// global in core/* and dapp/views/*.
var MINIMAADS_CREATOR_PK = '0X30819F300D06092A864886F70D010101050003818D0030818902818100969A89875DC17DAB90D87DE97FD1BFAF3937827F0A05887AD420C47C969C89A8E1DBEA4443103D61132ECFB25A8F038035B8B5D0780853F281C0BC7D0E1441E9EA5C91A9F558EF20AAEA673E3BB7E29F01A807E335E94CFEFBDE9AE3642F78726765936AF827ACCF4CE80976F2696F833F5BC9CCBE0F530EABF4A8E292A43D0B0203010001';
