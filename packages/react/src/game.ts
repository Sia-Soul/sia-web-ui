import { initializeDefaultScrollbars } from "./components/FloatingScrollbarProvider";

// 游戏入口同样默认启用浮动滚动条。
initializeDefaultScrollbars();

/** 独立游戏框架入口；基础交互复用 Sia 组件，不引入图表及编辑器。 */
import './styles.css';
import './game/game.css';
// 默认暗色面板皮肤由框架统一提供，业务项目无需自行编写组件样式。
import './game/dark-theme.css';
// 六边形战场及能力装配同样归属于游戏框架，宿主只提供题材配置。
import './game/hex-battle.css';
export * from './game/types';
export * from './game/engine';
export * from './game/components';
export * from './game/IdleGameApp';
export * from './game/HexBattlefield';
export * from './game/LoadoutPanel';
export * from './game/hex-playback';
export { gameAbilities, gameHexCells, hexDistance } from './game/hex-rules';
