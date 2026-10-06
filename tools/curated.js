// Handplockad data som inte går att läsa ut ur Liquipedias infoboxar.
// [Liquipedia-sida, lag spelaren är mest känd för, VCT-region, huvudroll]
// Roller: Duelist, Initiator, Controller, Sentinel, Flex (spelar flera roller).
// Rollerna är baserade på mest spelade agenter (vlr.gg) och spelarnas kända roll.
const PLAYERS = [
  ['TenZ', 'Sentinels', 'Americas', 'Duelist'], ['ShahZaM', 'Sentinels', 'Americas', 'Initiator'],
  ['SicK', 'Sentinels', 'Americas', 'Flex'], ['dapr', 'Sentinels', 'Americas', 'Sentinel'],
  ['zombs', 'Sentinels', 'Americas', 'Controller'], ['Zellsis', 'Sentinels', 'Americas', 'Initiator'],
  ['zekken', 'Sentinels', 'Americas', 'Duelist'], ['johnqt', 'Sentinels', 'Americas', 'Controller'],
  ['yay', 'OpTic Gaming', 'Americas', 'Duelist'], ['FNS', 'OpTic Gaming', 'Americas', 'Sentinel'],
  ['Marved', 'OpTic Gaming', 'Americas', 'Controller'], ['crashies', 'OpTic Gaming', 'Americas', 'Initiator'],
  ['Victor', 'OpTic Gaming', 'Americas', 'Duelist'],
  ['Boostio', 'Evil Geniuses', 'Americas', 'Sentinel'], ['C0M', 'Evil Geniuses', 'Americas', 'Initiator'],
  ['jawgemo', 'Evil Geniuses', 'Americas', 'Duelist'], ['Demon1', 'Evil Geniuses', 'Americas', 'Duelist'],
  ['Ethan', 'NRG', 'Americas', 'Initiator'], ['s0m', 'NRG', 'Americas', 'Controller'],
  ['brawk', 'NRG', 'Americas', 'Initiator'], ['mada', 'NRG', 'Americas', 'Duelist'], ['skuba', 'NRG', 'Americas', 'Sentinel'],
  ['aspas', 'LOUD', 'Americas', 'Duelist'], ['Less', 'LOUD', 'Americas', 'Sentinel'], ['Saadhak', 'LOUD', 'Americas', 'Flex'],
  ['pANcada', 'LOUD', 'Americas', 'Controller'], ['tuyz', 'LOUD', 'Americas', 'Initiator'],
  ['cauanzin', 'LOUD', 'Americas', 'Initiator'], ['Sacy', 'LOUD', 'Americas', 'Initiator'],
  ['Asuna', '100 Thieves', 'Americas', 'Duelist'], ['Hiko', '100 Thieves', 'Americas', 'Sentinel'],
  ['nitr0', '100 Thieves', 'Americas', 'Controller'], ['Cryocells', '100 Thieves', 'Americas', 'Duelist'],
  ['bang', '100 Thieves', 'Americas', 'Controller'],
  ['leaf', 'G2 Esports', 'Americas', 'Sentinel'], ['trent', 'G2 Esports', 'Americas', 'Initiator'],
  ['valyn', 'G2 Esports', 'Americas', 'Controller'], ['JonahP', 'G2 Esports', 'Americas', 'Initiator'],
  ['Xeppaa', 'Cloud9', 'Americas', 'Initiator'], ['vanity', 'Cloud9', 'Americas', 'Controller'],
  ['kiNgg', 'Leviatán', 'Americas', 'Controller'], ['Mazino', 'Leviatán', 'Americas', 'Controller'],

  ['Boaster', 'FNATIC', 'EMEA', 'Controller'], ['Derke', 'FNATIC', 'EMEA', 'Duelist'], ['Chronicle', 'FNATIC', 'EMEA', 'Flex'],
  ['Alfajer', 'FNATIC', 'EMEA', 'Sentinel'], ['Leo', 'FNATIC', 'EMEA', 'Initiator'], ['kaajak', 'FNATIC', 'EMEA', 'Duelist'],
  ['nAts', 'Gambit Esports', 'EMEA', 'Sentinel'], ['Redgar', 'Gambit Esports', 'EMEA', 'Initiator'],
  ['Sheydos', 'Gambit Esports', 'EMEA', 'Flex'], ['d3ffo', 'Gambit Esports', 'EMEA', 'Duelist'],
  ['cNed', 'Acend', 'EMEA', 'Duelist'], ['starxo', 'Acend', 'EMEA', 'Initiator'], ['zeek', 'Acend', 'EMEA', 'Flex'],
  ['BONECOLD', 'Acend', 'EMEA', 'Controller'], ['Kiles', 'Acend', 'EMEA', 'Controller'],
  ['ANGE1', 'FunPlus Phoenix', 'EMEA', 'Controller'], ['Shao', 'FunPlus Phoenix', 'EMEA', 'Initiator'],
  ['SUYGETSU', 'FunPlus Phoenix', 'EMEA', 'Sentinel'], ['Zyppan', 'FunPlus Phoenix', 'EMEA', 'Flex'],
  ['ardiis', 'FunPlus Phoenix', 'EMEA', 'Duelist'],
  ['ScreaM', 'Team Liquid', 'EMEA', 'Duelist'], ['Nivera', 'Team Liquid', 'EMEA', 'Sentinel'],
  ['Jamppi', 'Team Liquid', 'EMEA', 'Flex'], ['soulcas', 'Team Liquid', 'EMEA', 'Controller'], ['L1NK', 'Team Liquid', 'EMEA', 'Initiator'],
  ['Boo', 'Team Heretics', 'EMEA', 'Controller'], ['MiniBoo', 'Team Heretics', 'EMEA', 'Duelist'],
  ['RieNs', 'Team Heretics', 'EMEA', 'Initiator'], ['benjyfishy', 'Team Heretics', 'EMEA', 'Sentinel'], ['Wo0t', 'Team Heretics', 'EMEA', 'Duelist'],

  ['f0rsakeN', 'Paper Rex', 'Pacific', 'Flex'], ['Jinggg', 'Paper Rex', 'Pacific', 'Duelist'], ['d4v41', 'Paper Rex', 'Pacific', 'Flex'],
  ['something', 'Paper Rex', 'Pacific', 'Duelist'], ['mindfreak (Indonesian player)', 'Paper Rex', 'Pacific', 'Controller'],
  ['Benkai', 'Paper Rex', 'Pacific', 'Sentinel'], ['PatMen', 'Paper Rex', 'Pacific', 'Flex'],
  ['stax', 'DRX', 'Pacific', 'Initiator'], ['BuZz', 'DRX', 'Pacific', 'Duelist'], ['Rb', 'DRX', 'Pacific', 'Flex'],
  ['MaKo', 'DRX', 'Pacific', 'Controller'], ['Zest', 'DRX', 'Pacific', 'Initiator'], ['Foxy9', 'DRX', 'Pacific', 'Duelist'],
  ['Meteor', 'Gen.G', 'Pacific', 'Sentinel'], ['t3xture', 'Gen.G', 'Pacific', 'Duelist'], ['Munchkin', 'Gen.G', 'Pacific', 'Initiator'],
  ['Lakia', 'Gen.G', 'Pacific', 'Initiator'], ['Karon', 'Gen.G', 'Pacific', 'Controller'],
  ['iZu', 'T1', 'Pacific', 'Duelist'], ['Sylvan', 'T1', 'Pacific', 'Controller'],
  ['Laz', 'ZETA DIVISION', 'Pacific', 'Initiator'], ['crow', 'ZETA DIVISION', 'Pacific', 'Initiator'],
  ['Dep', 'ZETA DIVISION', 'Pacific', 'Duelist'], ['SugarZ3ro', 'ZETA DIVISION', 'Pacific', 'Controller'],
  ['TENNN', 'ZETA DIVISION', 'Pacific', 'Sentinel'],
  ['invy', 'Team Secret', 'Pacific', 'Duelist'], ['JessieVash', 'Team Secret', 'Pacific', 'Initiator'],
  ['Dambi', 'Nongshim RedForce', 'Pacific', 'Duelist'], ['Francis', 'Nongshim RedForce', 'Pacific', 'Duelist'],

  ['ZmjjKK', 'EDward Gaming', 'China', 'Duelist'], ['CHICHOO', 'EDward Gaming', 'China', 'Controller'],
  ['nobody', 'EDward Gaming', 'China', 'Initiator'], ['Smoggy', 'EDward Gaming', 'China', 'Flex'],
  ['S1Mon', 'EDward Gaming', 'China', 'Initiator'],
];

// Internationella titlar (Masters + Champions). Startfemmorna enligt Liquipedia.
const TITLES = [
  ['Masters Reykjavík 2021', ['ShahZaM', 'SicK', 'zombs', 'dapr', 'TenZ']],
  ['Masters Berlin 2021', ['d3ffo', 'Chronicle', 'nAts', 'Redgar', 'Sheydos']],
  ['Champions 2021', ['BONECOLD', 'cNed', 'Kiles', 'starxo', 'zeek']],
  ['Masters Reykjavík 2022', ['FNS', 'Victor', 'crashies', 'yay', 'Marved']],
  ['Masters Copenhagen 2022', ['ANGE1', 'Shao', 'Zyppan', 'SUYGETSU', 'ardiis']],
  ['Champions 2022', ['pANcada', 'Sacy', 'Saadhak', 'aspas', 'Less']],
  ['LOCK//IN 2023', ['Boaster', 'Derke', 'Alfajer', 'Leo', 'Chronicle']],
  ['Masters Tokyo 2023', ['Boaster', 'Derke', 'Alfajer', 'Leo', 'Chronicle']],
  ['Champions 2023', ['Boostio', 'Ethan', 'jawgemo', 'C0M', 'Demon1']],
  ['Masters Madrid 2024', ['zekken', 'Sacy', 'TenZ', 'johnqt', 'Zellsis']],
  ['Masters Shanghai 2024', ['Meteor', 't3xture', 'Lakia', 'Munchkin', 'Karon']],
  ['Champions 2024', ['CHICHOO', 'nobody', 'ZmjjKK', 'Smoggy', 'S1Mon']],
  ['Masters Bangkok 2025', ['iZu', 'stax', 'Sylvan', 'Meteor', 'BuZz']],
  ['Masters Toronto 2025', ['d4v41', 'f0rsakeN', 'something', 'Jinggg', 'PatMen']],
  ['Champions 2025', ['Ethan', 's0m', 'mada', 'brawk', 'skuba']],
  ['Masters Santiago 2026', ['Xross', 'Francis', 'Ivy', 'Rb', 'Dambi']],
  ['Masters London 2026', ['blowz', 'Neon', 'Sato', 'spikeziN', 'kiNgg']],
];

// Liquipedia döljer nationalitet för vissa spelare ("xx").
const COUNTRY_OVERRIDE = { Shao: 'RU', SUYGETSU: 'RU' };

module.exports = { PLAYERS, TITLES, COUNTRY_OVERRIDE };
