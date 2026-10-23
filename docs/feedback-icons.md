# 提示状态图标约定

<!-- 统一提示组件的默认视觉，业务页面不覆盖内部样式。 -->

Message 的信息、成功、警告、错误状态，Alert 的状态图标，以及 Modal 的信息、成功、警告、错误和确认提示，默认采用 Icon 的 `variant="filled"`。Notification、Popconfirm、Result 和 Form 校验提示已采用同一规则。

默认是否显示图标的行为不变：Alert 仍由 showIcon / banner 控制，普通 Modal 不新增图标。加载旋转图标、关闭按钮及其他操作图标不属于提示状态图标，保持原表现。支持自定义图标的组件仍尊重业务传入的节点；Icon 本身仍默认 outline，页面显式自定义提示图标时应优先设置 filled。

浏览器回归：`scripts/test-feedback-filled-icons.cjs`。
