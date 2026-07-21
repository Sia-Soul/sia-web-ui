import { useEffect, useState } from "react";
import { Alert, Col, DatePicker, Form, Modal, Row, Select, TextArea, Input } from "@sia-ui/react";
import type { FormRule, FormValues } from "@sia-ui/react";
import type { ProjectRecord } from "../projects/projectRepository";
import type {
  SaveWorkItemInput,
  WorkItemPriority,
  WorkItemRecord,
  WorkItemStatus,
  WorkItemType,
} from "./workItemRepository";

interface WorkItemFormModalProps {
  open: boolean;
  item: WorkItemRecord | null;
  projects: readonly ProjectRecord[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: SaveWorkItemInput) => Promise<void>;
}

interface WorkItemFormValues extends FormValues {
  title: string;
  itemType: WorkItemType;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  projectId: string;
  dueDate: string;
  description: string;
}

const TYPE_OPTIONS = [
  { label: "任务", value: "task" },
  { label: "BUG", value: "bug" },
] as const;

const STATUS_OPTIONS = [
  { label: "待规划", value: "backlog" },
  { label: "待处理", value: "todo" },
  { label: "进行中", value: "in_progress" },
  { label: "已阻塞", value: "blocked" },
  { label: "已完成", value: "done" },
  { label: "已取消", value: "cancelled" },
] as const;

const PRIORITY_OPTIONS = [
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
  { label: "紧急", value: "urgent" },
] as const;

const TITLE_RULES: readonly FormRule[] = [
  { required: true, whitespace: true, message: "请输入任务标题" },
  { max: 160, message: "任务标题不能超过 160 个字符" },
];

function emptyValues(): WorkItemFormValues {
  return {
    title: "",
    itemType: "task",
    status: "todo",
    priority: "medium",
    projectId: "",
    dueDate: "",
    description: "",
  };
}

function valuesFromItem(item: WorkItemRecord | null): WorkItemFormValues {
  if (!item) return emptyValues();
  return {
    title: item.title,
    itemType: item.itemType,
    status: item.status,
    priority: item.priority,
    projectId: item.projectId ?? "",
    dueDate: item.dueDate ?? "",
    description: item.description,
  };
}

export default function WorkItemFormModal({
  open,
  item,
  projects,
  onOpenChange,
  onSubmit,
}: WorkItemFormModalProps) {
  const [form] = Form.useForm();
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(valuesFromItem(item));
    setFormError("");
  }, [form, item, open]);

  async function handleSubmit() {
    try {
      const values = await form.validateFields() as FormValues & WorkItemFormValues;
      await onSubmit({
        id: item?.id ?? crypto.randomUUID(),
        title: values.title.trim(),
        itemType: values.itemType,
        status: values.status,
        priority: values.priority,
        projectId: values.projectId || null,
        dueDate: values.dueDate || null,
        description: values.description.trim(),
      });
      return true;
    } catch (error) {
      if (error instanceof Error) setFormError(error.message);
      return false;
    }
  }

  const projectOptions = [
    { label: "不关联项目", value: "" },
    ...projects.filter((project) => !project.archivedAt).map((project) => ({
      label: project.name,
      value: project.id,
    })),
  ];

  return (
    <Modal
      open={open}
      title={item ? "编辑任务 / BUG" : "新建任务 / BUG"}
      width={640}
      okText={item ? "保存修改" : "创建"}
      cancelText="取消"
      maskClosable={false}
      onOk={handleSubmit}
      onOpenChange={onOpenChange}
      onCancel={() => onOpenChange(false)}
    >
      <Form
        className="work-item-form-modal"
        form={form}
        layout="vertical"
        onValuesChange={() => setFormError("")}
      >
        {formError ? <Alert status="error" message={formError} showIcon /> : null}

        <Form.Item name="title" label="标题" rules={TITLE_RULES}>
          <Input maxLength={160} placeholder="描述需要完成的工作或发现的问题" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="itemType" label="类型">
              <Select options={TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="状态">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="priority" label="优先级">
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={14}>
            <Form.Item name="projectId" label="关联项目">
              <Select options={projectOptions} />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="dueDate" label="截止日期">
              <DatePicker placeholder="选择截止日期" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="详细说明">
          <TextArea
            maxLength={5000}
            rows={6}
            showCount
            placeholder="补充验收标准、复现步骤、影响范围或处理备注"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
