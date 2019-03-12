pragma solidity 0.4.24;

import "@aragon/os/contracts/kernel/Kernel.sol";
import "@aragon/os/contracts/acl/ACL.sol";
import "@aragon/os/contracts/apm/APMNamehash.sol";

import "@aragon/apps-curation/contracts/Curation.sol";
import "@aragon/apps-registry/contracts/RegistryApp.sol";
import "staking/contracts/Staking.sol";
import "@aragon/apps-plcr/contracts/PLCR.sol";

import "@aragon/kits-base/contracts/KitBase.sol";


contract TCRKit is KitBase, APMNamehash {
    RegistryApp registry;
    Staking staking;
    PLCR plcr;
    Curation curation;

    constructor(DAOFactory _fac, ENS _ens) KitBase(_fac, _ens) public {}

    function newInstance(
        address root,
        Staking _staking,
        uint256 voteQuorum,
        uint256 minorityBlocSlash,
        uint64 commitDuration,
        uint64 revealDuration
    )
        public
        returns (Kernel dao)
    {
        staking = _staking;

        dao = fac.newDAO(this);
        ACL acl = ACL(dao.acl());

        acl.createPermission(this, dao, dao.APP_MANAGER_ROLE(), this);

        deployApps(dao);

        //registry.initialize();
        plcr.initialize(staking, voteQuorum, minorityBlocSlash, commitDuration, revealDuration);

        // ACLs
        // Registry
        acl.createPermission(curation, registry, registry.ADD_ENTRY_ROLE(), root);
        acl.createPermission(curation, registry, registry.REMOVE_ENTRY_ROLE(), root);
        // PLCR
        acl.createPermission(curation, plcr, plcr.CREATE_VOTE_ROLE(), root);
        // Curation
        acl.createPermission(root, curation, curation.CHANGE_PARAMS_ROLE(), root);
        acl.createPermission(root, curation, curation.CHANGE_VOTING_APP_ROLE(), root);

        cleanupDAOPermissions(dao, acl, root);

        emit DeployInstance(dao);
    }

    function initCuration(uint256 minDeposit, uint64 applyStageLen, uint256 dispensationPct) public returns (Curation) {
        curation.initialize(registry, staking, plcr, minDeposit, applyStageLen, dispensationPct);

        return curation;
    }


    function deployApps(Kernel dao) internal {
        bytes32 registryAppId = apmNamehash("registry");
        bytes32 plcrAppId = apmNamehash("plcr");
        bytes32 curationAppId = apmNamehash("curation");

        registry = RegistryApp(dao.newAppInstance(registryAppId, latestVersionAppBase(registryAppId)));
        plcr = PLCR(dao.newAppInstance(plcrAppId, latestVersionAppBase(plcrAppId)));
        curation = Curation(dao.newAppInstance(curationAppId, latestVersionAppBase(curationAppId)));

        emit InstalledApp(registry, registryAppId);
        emit InstalledApp(plcr, plcrAppId);
        emit InstalledApp(curation, curationAppId);
    }
}
