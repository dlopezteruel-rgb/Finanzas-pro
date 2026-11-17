/** Separate synthetic browser-test entry. Never imported by the application or its builds. */
export {openWebFinance,exclusiveWebOperation} from '../../src/platform/web/openFinance';
export {IndexedFinanceDriver} from '../../src/platform/web/indexedDb';
export {WebController} from '../../src/platform/web/controller';
export {exportWebForensic} from '../../src/platform/web/forensic';
export * from '../../src/platform/web/protocol';
export {legacyInventory,sourceHash,sourceData} from '../../src/platform/web/legacy';
export {intelligentFixture} from '../intelligentFixture';
export {multilingualCatalogFixture} from '../multilingualCatalogFixture';
export {DATA_KEY,RECOVERY_PREFIX,StorageConflictError,makeBackup,parseBackup,parseSnapshot,serializeSnapshot} from '../../src/utils/backup';
export {FinanceStore,browserExclusiveWrite} from '../../src/utils/financeStore';
export {webFinanceBinding} from '../../src/platform/financeBinding';
