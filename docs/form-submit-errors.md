# 表单异步提交与错误处理

`Form.onFinish` 在字段校验成功后执行，可以返回 Promise。`onFinishFailed` 只处理字段校验失败，不处理接口异常。接口失败时字段值保持不变，业务回调负责反馈错误，并在 `finally` 恢复提交状态。

```tsx
// 表单提交期间通过原生 Modal.confirmLoading 管理按钮和关闭行为。
<Modal open={open} confirmLoading={saving} onOk={() => { form.submit(); return false; }}>
  <Form form={form} onFinish={async values => {
    setSaving(true);
    try {
      await save(values);
      setOpen(false);
    } catch {
      // 若请求层已提示，不重复弹出 message；保留弹框与草稿以便重试。
    } finally {
      setSaving(false);
    }
  }}>
    <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
  </Form>
</Modal>
```

同步异常、Promise 拒绝以及非 Error 的拒绝值都不会被当作 `errorFields` 访问。框架不会替业务关闭弹框、重置字段或新增接口错误提示。关闭动画后的数据清理仍由 Modal 的完成回调管理。
