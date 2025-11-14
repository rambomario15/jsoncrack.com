import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, TextInput } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const updateNodeValues = useGraph(state => state.updateNodeValues);
  const contents = useFile(state => state.contents);
  const setContents = useFile(state => state.setContents);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editFields, setEditFields] = React.useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [codeRefreshKey, setCodeRefreshKey] = React.useState(0);

  // Initialize edit fields when entering edit mode
  React.useEffect(() => {
    if (isEditing && nodeData?.text) {
      const fields: Record<string, string> = {};
      nodeData.text.forEach(row => {
        if (row.type !== "array" && row.type !== "object" && row.key) {
          fields[row.key] = String(row.value ?? "");
        }
      });
      setEditFields(fields);
    }
  }, [isEditing, nodeData]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const coerceValue = (val: string) => {
    if (val === "null") return null;
    if (val === "true") return true;
    if (val === "false") return false;
    const n = Number(val);
    if (!Number.isNaN(n) && String(n) === val) return n;
    return val;
  };

  const handleSaveClick = () => {
    if (!nodeData) return;

    const updates = nodeData.text
      .map((row, index) => {
        if (row.type !== "array" && row.type !== "object" && row.key) {
          const newValue = editFields[row.key];
          if (newValue !== undefined && String(row.value) !== newValue) {
            return { index, value: coerceValue(newValue) };
          }
        }
        return null;
      })
      .filter((u): u is { index: number; value: any } => u !== null);

    if (updates.length > 0 && updateNodeValues) {
      updateNodeValues(nodeData.id, updates);
      
      try {
        const parsed = JSON.parse(contents);
        const nodes = useGraph.getState().nodes || [];
        const nodeToUpdate = nodes.find(n => n.id === nodeData.id);
        
        if (nodeToUpdate && nodeToUpdate.path) {
          let target: any = parsed;
          for (const seg of nodeToUpdate.path) {
            target = target[seg as any];
          }
          
          updates.forEach(u => {
            const row = nodeToUpdate.text[u.index];
            if (row && row.key) {
              target[row.key] = u.value;
            }
          });
          
          const updatedJson = JSON.stringify(parsed, null, 2);
          setContents({ contents: updatedJson, skipUpdate: false });
        }
      } catch (error) {
        console.error("Failed to sync to text editor:", error);
      }
      
      // Refresh selectedNode from updated graph state to reflect new values
      const updatedNode = useGraph.getState().nodes.find(n => n.id === nodeData.id);
      if (updatedNode) {
        useGraph.getState().setSelectedNode(updatedNode);
      }
      
      setRefreshKey(prev => prev + 1);
      setCodeRefreshKey(prev => prev + 1);
      setTimeout(() => {
        setIsEditing(false);
      }, 100);
    } else {
      setIsEditing(false);
    }
  };

  const handleCancelClick = () => {
    setEditFields({});
    setIsEditing(false);
  };

  const handleFieldChange = (key: string, value: string) => {
    setEditFields(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm" key={refreshKey}>
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs">
              {!isEditing ? (
                <Button
                  color="blue"
                  size="xs"
                  onClick={handleEditClick}
                >
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    color="green"
                    size="xs"
                    onClick={handleSaveClick}
                  >
                    Save
                  </Button>
                  <Button
                    color="red"
                    size="xs"
                    onClick={handleCancelClick}
                  >
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>

          <ScrollArea.Autosize mah={250} maw={600}>
            {!isEditing ? (
              <CodeHighlight
                key={`code-${codeRefreshKey}`}
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Stack gap="md" p="sm">
                {nodeData?.text
                  ?.filter(row => row.type !== "array" && row.type !== "object" && row.key)
                  .map(row => (
                    <Stack key={row.key} gap="xs">
                      <Text fz="sm" fw={500}>
                        {row.key}
                      </Text>
                      <TextInput
                        placeholder={String(row.value ?? "")}
                        value={editFields[row.key!] ?? ""}
                        onChange={e => handleFieldChange(row.key!, e.currentTarget.value)}
                      />
                    </Stack>
                  ))}
              </Stack>
            )}
          </ScrollArea.Autosize>
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
