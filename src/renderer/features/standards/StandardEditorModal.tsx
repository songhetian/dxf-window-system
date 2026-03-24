import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  TextInput,
} from '@mantine/core';

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildPatternFromPrefixes = (rawPrefix: string, mode: string) => {
  const prefixes = rawPrefix
    .split(/[，,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const source = prefixes.length > 1
    ? `(?:${prefixes.map(escapeRegex).join('|')})`
    : escapeRegex(prefixes[0] || 'C');

  if (mode === 'standard') return `^${source}\\d{4}$`;
  if (mode === 'flexible') return `^${source}\\d+$`;
  return `.*${source}.*`;
};

export const defaultStandardForm = {
  name: '',
  prefix: 'C',
  mode: 'standard',
  wallAreaThreshold: 4,
  minWindowArea: 0.08,
  minSideLength: 180,
  labelMaxDistance: 600,
  layerIncludeKeywords: '窗,window,win',
  layerExcludeKeywords: '标注,text,dim,轴网,图框,title',
};

export type StandardFormValue = typeof defaultStandardForm;

interface StandardEditorModalProps {
  opened: boolean;
  title: string;
  submitLabel: string;
  initialValue?: StandardFormValue;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (value: StandardFormValue) => Promise<void> | void;
}

export const StandardEditorModal = ({
  opened,
  title,
  submitLabel,
  initialValue = defaultStandardForm,
  loading = false,
  onClose,
  onSubmit,
}: StandardEditorModalProps) => {
  const [form, setForm] = useState<StandardFormValue>(initialValue);

  useEffect(() => {
    if (opened) {
      setForm(initialValue);
    }
  }, [initialValue, opened]);

  const pattern = useMemo(() => buildPatternFromPrefixes(form.prefix, form.mode), [form.prefix, form.mode]);

  const update = <K extends keyof StandardFormValue>(key: K, next: StandardFormValue[K]) => {
    setForm((current) => ({ ...current, [key]: next }));
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered radius="md" size="lg">
      <Stack>
        <TextInput
          label="规则名称"
          value={form.name}
          onChange={(event) => update('name', event.currentTarget.value)}
          placeholder="例如：幕墙项目标准"
        />
        <TextInput
          label="窗编号开头"
          description="直接填你图纸里常见的编号开头，多个用逗号隔开，例如：C,CT"
          value={form.prefix}
          onChange={(event) => update('prefix', event.currentTarget.value.toUpperCase())}
          placeholder="例如：C,CT"
        />
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={() => update('prefix', 'C')}>常用：C</Button>
          <Button variant="default" size="xs" onClick={() => update('prefix', 'CT')}>常用：CT</Button>
          <Button variant="default" size="xs" onClick={() => update('prefix', 'C,CT')}>常用：C,CT</Button>
        </Group>
        <SegmentedControl
          value={form.mode}
          onChange={(next) => update('mode', next)}
          data={[
            { label: '固定4位数字', value: 'standard' },
            { label: '任意位数字', value: 'flexible' },
            { label: '只要包含开头', value: 'contains' },
          ]}
        />
        <TextInput label="系统生成的识别规则" value={pattern} readOnly />
        <NumberInput
          label="墙体面积阈值 (㎡)"
          description="超过该面积的闭合轮廓会被当成墙体包络，用来判断真窗 / 大样"
          value={form.wallAreaThreshold}
          onChange={(next) => update('wallAreaThreshold', Number(next) || 0)}
          min={0}
          decimalScale={2}
        />
        <NumberInput
          label="最小窗面积 (㎡)"
          description="小于这个面积的闭合框直接忽略，避免把文字框、索引框识别成窗"
          value={form.minWindowArea}
          onChange={(next) => update('minWindowArea', Number(next) || 0)}
          min={0}
          decimalScale={3}
        />
        <NumberInput
          label="最小边长 (mm)"
          description="宽或高小于这个值的候选窗不参与识别"
          value={form.minSideLength}
          onChange={(next) => update('minSideLength', Number(next) || 0)}
          min={0}
        />
        <NumberInput
          label="编号离窗框最远允许多远 (mm)"
          description="如果编号文字没有画在窗框里面，系统最多会在这个距离内帮你找最近的窗框"
          value={form.labelMaxDistance}
          onChange={(next) => update('labelMaxDistance', Number(next) || 0)}
          min={0}
        />
        <TextInput
          label="优先识别的图层关键词"
          description="多个用逗号隔开，例如：窗,window,win。图里有这些图层时会优先拿来识别；如果一个都没有，系统会自动回退。"
          value={form.layerIncludeKeywords}
          onChange={(event) => update('layerIncludeKeywords', event.currentTarget.value)}
          placeholder="窗,window,win"
        />
        <TextInput
          label="排除的图层关键词"
          description="这些图层会直接跳过，建议填：标注,text,dim,轴网,图框,title"
          value={form.layerExcludeKeywords}
          onChange={(event) => update('layerExcludeKeywords', event.currentTarget.value)}
          placeholder="标注,text,dim,轴网,图框,title"
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit(form)} loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
