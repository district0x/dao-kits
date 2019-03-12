const fs = require('fs')
const namehash = require('eth-ens-namehash').hash

const getContract = name => artifacts.require(name)
const getApp = (receipt, app, index) => { return receipt.logs.filter(l => l.event == 'InstalledApp' && l.args['appId'] == namehash(app))[index].args['appProxy'] }
const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))
const getEventResult = (receipt, event, param) => receipt.logs.filter(l => l.event == event)[0].args[param]

const errorOut = msg => { console.error(msg); process.exit(1) }

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle
const defaultOwner = process.env.OWNER

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    owner = defaultOwner,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  if (process.argv.length < 8) {
    errorOut('Usage: truffle exec --network <network> scripts/deploy_tcr.js <params_file> <result_file>')
  }

  // get network
  const network = process.argv[4]

  // get config
  let arappFileName
  if (network != 'rpc' && network != 'devnet') {
    arappFileName = 'arapp'
  } else {
    arappFileName = 'arapp_local'
  }
  const arappObj = require('../' + arappFileName)
  const tcrKitAddress = arappObj.environments[network].address
  const stakingAddress = arappObj.environments[network].staking

  log('owner', owner)
  log('tcrKitAddress', tcrKitAddress)
  log('stakingAddress', stakingAddress)

  const paramsObj = require(process.argv[6])
  const resultFileName = process.argv[7]
  // curation params
  const minDeposit = paramsObj['minDeposit']
  const applyStageLen = paramsObj['applyStageLen']
  const dispensationPct = pct16(paramsObj['dispensationPct'])
  // voting params
  const voteQuorum = pct16(paramsObj['voteQuorum'])
  const minorityBlocSlash = pct16(paramsObj['minorityBlocSlash'])
  const commitDuration = paramsObj['commitDuration']
  const revealDuration = paramsObj['revealDuration']

  const TCRKit = getContract('TCRKit').at(tcrKitAddress)
  const r1 = await TCRKit.newInstance(owner, stakingAddress, voteQuorum, minorityBlocSlash, commitDuration, revealDuration)
  if (r1.receipt.status != '0x1') {
    console.log(r1)
    errorOut("New TCRKit transaction should succeed")
  }
  const kitInstance = getEventResult(r1, 'DeployInstance', 'dao')
  log('New kit instance deloyed at: ', kitInstance)

  const curation = getContract('Curation').at(getApp(r1, 'curation.aragonpm.eth', 0))
  const registry = getContract('RegistryApp').at(getApp(r1, 'registry.aragonpm.eth', 0))
  const plcr = getContract('PLCR').at(getApp(r1, 'plcr.aragonpm.eth', 0))
  //const MAX_UINT64 = await curation.MAX_UINT64()
  const r2 = await TCRKit.initCuration(minDeposit, applyStageLen, dispensationPct)
  if (r2.receipt.status != '0x1') {
    console.log(r2)
    errorOut("TCRKit initCuration transaction should succeed")
  }

  let resultObj = {}
  resultObj['dao'] = kitInstance
  resultObj['registry'] = registry.address
  resultObj['staking'] = stakingAddress
  resultObj['plcr'] = plcr.address
  resultObj['curation'] = curation.address
  fs.writeFileSync(resultFileName, JSON.stringify(resultObj, null, 2))
  log('Result saved to ' + resultFileName)

  if (typeof truffleExecCallback === 'function') {
    // Called directly via `truffle exec`
    truffleExecCallback()
  } else {
    return resultObj
  }
}
