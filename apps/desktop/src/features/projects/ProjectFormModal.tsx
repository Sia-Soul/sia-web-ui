import { useEffect, useState } from "react";
import { Alert, Col, DatePicker, Form, Input, Modal, Row, Select, TextArea } from "@sia.soul/sia-react-ui";
import type { FormRule, FormValues } from "@sia.soul/sia-react-ui";
import type { ProjectPriority, ProjectRecord, ProjectStatus, SaveProjectInput } from "./projectRepository";

interface ProjectFormModalProps {
  open: boolean;
  project: ProjectRecord | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: SaveProjectInput) => Promise<void>;
}

interface ProjectFormValues extends FormValues {
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  companyName: string;
  startDate: string;
  dueDate: string;
}

const STATUS_OPTIONS = [
  { label: "规划中", value: "planning" },
  { label: "进行中", value: "active" },
  { label: "已暂停", value: "paused" },
  { label: "已完成", value: "completed" },
] as const;

const PRIORITY_OPTIONS = [
  { label: "低", value: "low" },
  { label: "中", value: "medium" },
  { label: "高", value: "high" },
  { label: "紧急", value: "urgent" },
] as const;

const PROJECT_NAME_RULES: readonly FormRule[] = [
  { required: true, whitespace: true, message: "请输入项目名称" },
  { max: 120, message: "项目名称不能超过 120 个字符" },
];

const DUE_DATE_RULES: readonly FormRule[] = [{
  validator(_rule, value, values) {
    const startDate = typeof values.startDate === "string" ? values.startDate : "";
    const dueDate = typeof value === "string" ? value : "";
    if (startDate && dueDate && dueDate < startDate) throw new Error("项目结束日期不能早于开始日期");
  },
}];

function emptyValues(): ProjectFormValues {
  return {
    name: "",
    code: "",
    description: "",
    status: "planning",
    priority: "medium",
    companyName: "",
    startDate: "",
    dueDate: "",
  };
}

function valuesFromProject(project: ProjectRecord | null): ProjectFormValues {
  if (!project) return emptyValues();
  return {
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    priority: project.priority,
    companyName: project.companyName ?? "",
    startDate: project.startDate ?? "",
    dueDate: project.dueDate ?? "",
  };
}

export default function ProjectFormModal({ open, project, onOpenChange, onSubmit }: ProjectFormModalProps) {
  const [form] = Form.useForm();
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(valuesFromProject(project));
    setFormError("");
  }, [form, open, project]);

  async function handleSubmit() {
    try {
      const values = await form.validateFields() as FormValues & ProjectFormValues;
      const companyName = values.companyName.trim();
      const sameCompany = companyName && project?.companyName?.toLocaleLowerCase() === companyName.toLocaleLowerCase();
      const input: SaveProjectInput = {
        id: project?.id ?? crypto.randomUUID(),
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description.trim(),
        status: values.status,
        priority: values.priority,
        companyId: companyName ? sameCompany ? project?.companyId ?? crypto.randomUUID() : crypto.randomUUID() : null,
        companyName: companyName || null,
        startDate: values.startDate || null,
        dueDate: values.dueDate || null,
      };
      await onSubmit(input);
      return true;
    } catch (error) {
      if (error instanceof Error) setFormError(error.message);
      return false;
    }
  }

  return (
    <Modal
      open={open}
      title={project ? "编辑项目" : "创建项目"}
      width={620}
      okText={project ? "保存修改" : "创建项目"}
      cancelText="取消"
      maskClosable={false}
      onOk={handleSubmit}
      onOpenChange={onOpenChange}
      onCancel={() => onOpenChange(false)}
    >
      <Form
        className="project-form-modal"
        form={form}
        layout="vertical"
        onValuesChange={() => setFormError("")}
      >
        {formError ? <Alert status="error" message={formError} showIcon /> : null}

        <Row gutter={16}>
          <Col span={15}>
            <Form.Item name="name" label="项目名称" rules={PROJECT_NAME_RULES}>
              <Input maxLength={120} placeholder="例如：Sia 客户端工作台" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item name="code" label="项目编号">
              <Input maxLength={40} placeholder="例如：SIA-WORKBENCH" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="companyName" label="所属公司">
          <Input maxLength={120} placeholder="可选；后续可在“我的公司”中统一管理" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="status" label="项目状态">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="priority" label="优先级">
              <Select options={PRIORITY_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="startDate" label="开始日期">
              <DatePicker placeholder="选择开始日期" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dueDate" label="结束日期" rules={DUE_DATE_RULES}>
              <DatePicker placeholder="选择结束日期" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="项目说明">
          <TextArea maxLength={2000} rows={4} showCount placeholder="记录项目目标、范围或关键背景" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
