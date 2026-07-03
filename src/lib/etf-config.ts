// 兼容旧代码：从 security-library 导出，保留 ETF_CONFIGS 接口
export {
  SECURITY_LIBRARY as ETF_CONFIGS,
  SECURITY_BY_ID as ETF_BY_ID,
  DEFAULT_WATCHLIST,
} from './security-library';
export type { SecurityInfo as EtfConfig } from './security-library';
