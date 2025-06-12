"use server";
import { db } from "@/lib/kysely";

export interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  size?: string;
  format?: string;
  children?: TreeNode[];
  sign?: string;
}

export const getFileList = async (id: string) => {
  const isVNDB = /^v\d+$/.test(id);
  const targetKey = `${isVNDB ? "vndb" : "other"}-${id}`;
  const keyPattern = `%[${targetKey}]%`;

  const rows = await db
    .selectFrom("galrc_search_nodes")
    .selectAll()
    .where("parent", "like", keyPattern)
    .execute();

  type TreeNodeBuilder = Omit<TreeNode, "children"> & {
    children?: Record<string, TreeNodeBuilder>;
  };
  const root: Record<string, TreeNodeBuilder> = {};

  for (const row of rows) {
    const fullPath = row.parent.endsWith("/")
      ? row.parent + row.name
      : row.parent + "/" + row.name;
    const parts = fullPath.split("/").filter(Boolean);
    let currentLevel = root;
    let parentId = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const nodeId = (parentId ? parentId + "/" : "") + part;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          id: nodeId,
          name: part.replace(/\[(vndb|other)-[^\]]+\]/g, "").trim(),
          type: isLast && !row.is_dir ? "file" : "folder",
          ...(isLast && !row.is_dir
            ? {
                size: row.size !== undefined ? String(row.size) : undefined,
                format: part.includes(".")
                  ? part.substring(part.lastIndexOf(".") + 1).toUpperCase()
                  : undefined,
              }
            : {}),
        };
      }

      if (!currentLevel[part].children && (!isLast || row.is_dir)) {
        currentLevel[part].children = {};
      }

      if (!isLast) {
        currentLevel = currentLevel[part].children!;
        parentId = nodeId;
      }
    }
  }

  async function convert(
    node: Record<string, TreeNodeBuilder>
  ): Promise<TreeNode[]> {
    const nodes = await Promise.all(
      Object.values(node).map(async (n) => {
        const { children, ...rest } = n;
        const base: TreeNode = {
          ...rest,
          ...(children
            ? {
                children: await convert(
                  children as Record<string, TreeNodeBuilder>
                ),
              }
            : {}),
        };

        return base;
      })
    );
    return nodes;
  }

  const findMatchingSubtree = async (
    tree: Record<string, TreeNodeBuilder>,
    matchKey: string
  ): Promise<TreeNode[]> => {
    const result: TreeNode[] = [];

    for (const node of Object.values(tree)) {
      if (node.id.includes(matchKey)) {
        const { children, ...rest } = node;
        result.push({
          ...rest,
          ...(children ? { children: await convert(children!) } : {}),
        });
      } else if (node.children) {
        const childMatch = await findMatchingSubtree(node.children, matchKey);
        if (childMatch.length > 0) {
          result.push(...childMatch);
        }
      }
    }

    return result;
  };

  return await findMatchingSubtree(root, targetKey);
};
