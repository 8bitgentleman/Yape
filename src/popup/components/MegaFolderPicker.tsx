import React, { useState, useMemo, useCallback } from 'react';
import { FolderFile } from '../../common/api/megaFolder';
import { formatSize } from '../../common/utils/formatSize';

interface TreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: FolderFile;
}

function buildTree(files: FolderFile[]): TreeNode {
  const root: TreeNode = { id: 'root', name: 'root', isFolder: true, children: [] };
  const folderMap = new Map<string, TreeNode>([['', root]]);

  for (const file of files) {
    const parts = file.relativePath ? file.relativePath.split('/') : [];
    let parent = root;
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!folderMap.has(currentPath)) {
        const folderNode: TreeNode = { id: `folder:${currentPath}`, name: part, isFolder: true, children: [] };
        parent.children.push(folderNode);
        folderMap.set(currentPath, folderNode);
      }
      parent = folderMap.get(currentPath)!;
    }
    parent.children.push({ id: `file:${file.handle}`, name: file.fileName, isFolder: false, children: [], file });
  }

  return root;
}

interface FlatItem {
  key: string;
  node: TreeNode;
  depth: number;
  folderPath: string;
}

function flattenTree(node: TreeNode, expanded: Set<string>, depth = 0, parentPath = ''): FlatItem[] {
  const items: FlatItem[] = [];
  for (const child of node.children) {
    const folderPath = child.isFolder ? (parentPath ? `${parentPath}/${child.name}` : child.name) : '';
    items.push({ key: child.id, node: child, depth, folderPath });
    if (child.isFolder && expanded.has(folderPath)) {
      items.push(...flattenTree(child, expanded, depth + 1, folderPath));
    }
  }
  return items;
}

function collectHandles(node: TreeNode): string[] {
  if (!node.isFolder) return node.file ? [node.file.handle] : [];
  return node.children.flatMap(collectHandles);
}

function folderTotalSize(node: TreeNode): number {
  if (!node.isFolder) return node.file?.fileSize ?? 0;
  return node.children.reduce((sum, c) => sum + folderTotalSize(c), 0);
}

function folderFileCount(node: TreeNode): number {
  if (!node.isFolder) return node.file ? 1 : 0;
  return node.children.reduce((sum, c) => sum + folderFileCount(c), 0);
}

type SelectionState = 'all' | 'none' | 'mixed';

function folderSelectionState(node: TreeNode, selected: Set<string>): SelectionState {
  const handles = collectHandles(node);
  if (handles.length === 0) return 'none';
  const selectedCount = handles.filter(h => selected.has(h)).length;
  if (selectedCount === 0) return 'none';
  if (selectedCount === handles.length) return 'all';
  return 'mixed';
}

interface Props {
  files: FolderFile[];
  loading: boolean;
  folderName?: string;
  onConfirm: (selectedLinks: string[]) => void;
  onDismiss: () => void;
}

const MegaFolderPicker: React.FC<Props> = ({ files, loading, folderName, onConfirm, onDismiss }) => {
  const tree = useMemo(() => buildTree(files), [files]);

  const initialExpanded = useMemo(() => {
    const paths = new Set<string>();
    function collect(node: TreeNode, parentPath: string) {
      for (const child of node.children) {
        if (child.isFolder) {
          const path = parentPath ? `${parentPath}/${child.name}` : child.name;
          paths.add(path);
          collect(child, path);
        }
      }
    }
    collect(tree, '');
    return paths;
  }, [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(files.map(f => f.handle)));

  React.useEffect(() => {
    setSelected(new Set(files.map(f => f.handle)));
    setExpanded(initialExpanded);
  }, [files, initialExpanded]);

  const flatItems = useMemo(() => flattenTree(tree, expanded), [tree, expanded]);

  const toggleExpanded = useCallback((folderPath: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  }, []);

  const toggleFile = useCallback((handle: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(handle)) next.delete(handle);
      else next.add(handle);
      return next;
    });
  }, []);

  const toggleFolder = useCallback((node: TreeNode) => {
    const handles = collectHandles(node);
    const state = folderSelectionState(node, selected);
    const shouldSelect = state !== 'all';
    setSelected(prev => {
      const next = new Set(prev);
      for (const h of handles) {
        if (shouldSelect) next.add(h);
        else next.delete(h);
      }
      return next;
    });
  }, [selected]);

  const selectAll = () => setSelected(new Set(files.map(f => f.handle)));
  const deselectAll = () => setSelected(new Set());
  const invertAll = () => setSelected(prev => {
    const next = new Set<string>();
    for (const f of files) {
      if (!prev.has(f.handle)) next.add(f.handle);
    }
    return next;
  });

  const selectedFiles = files.filter(f => selected.has(f.handle));
  const selectedSize = selectedFiles.reduce((s, f) => s + f.fileSize, 0);
  const selectedCount = selectedFiles.length;

  const renderItem = (item: FlatItem) => {
    const { node, depth, folderPath } = item;
    const indent = depth * 14;

    if (node.isFolder) {
      const state = folderSelectionState(node, selected);
      const isExpanded = expanded.has(folderPath);
      const count = folderFileCount(node);
      const size = folderTotalSize(node);
      const checkClass =
        state === 'all' ? 'far fa-square-check' :
        state === 'mixed' ? 'fas fa-square-minus' :
        'far fa-square';

      return (
        <div key={item.key} className="mega-picker-row mega-picker-folder-row" style={{ paddingLeft: `${6 + indent}px` }}>
          <button className="mega-picker-checkbox-btn" onClick={() => toggleFolder(node)} title="Toggle folder selection">
            <i className={`${checkClass}${state !== 'none' ? ' text-primary' : ''}`} />
          </button>
          <button className="mega-picker-folder-btn" onClick={() => toggleExpanded(folderPath)}>
            <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} mega-picker-chevron`} />
            <i className="fas fa-folder text-primary" style={{ margin: '0 4px' }} />
            <span className="mega-picker-item-name">{node.name}</span>
            <span className="mega-picker-item-meta">{count} {count === 1 ? 'file' : 'files'} · {formatSize(size)}</span>
          </button>
        </div>
      );
    }

    const file = node.file!;
    const isSelected = selected.has(file.handle);
    return (
      <div
        key={item.key}
        className={`mega-picker-row mega-picker-file-row${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: `${6 + indent}px` }}
        onClick={() => toggleFile(file.handle)}
      >
        <i className={`${isSelected ? 'far fa-square-check text-primary' : 'far fa-square'} mega-picker-file-check`} />
        <span className="mega-picker-item-name">{node.name}</span>
        <span className="mega-picker-item-meta">{formatSize(file.fileSize)}</span>
      </div>
    );
  };

  return (
    <div className="mega-picker">
      <div className="mega-picker-header">
        <div className="mega-picker-title">
          <i className="fas fa-folder-open me-2 text-primary" />
          {folderName ?? 'Select Files'}
        </div>
        {!loading && (
          <div className="mega-picker-subtitle">{files.length} {files.length === 1 ? 'file' : 'files'} total</div>
        )}
      </div>

      {!loading && (
        <div className="mega-picker-action-bar">
          <button className="mega-picker-action-btn" onClick={selectAll}>All</button>
          <button className="mega-picker-action-btn" onClick={deselectAll}>None</button>
          <button className="mega-picker-action-btn" onClick={invertAll}>Invert</button>
        </div>
      )}

      <div className="mega-picker-list">
        {loading ? (
          <div className="mega-picker-loading">
            <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
            <span>Fetching folder contents…</span>
          </div>
        ) : (
          flatItems.map(item => renderItem(item))
        )}
      </div>

      <div className="mega-picker-footer">
        <div className="mega-picker-footer-info">
          <span className="mega-picker-count">{selectedCount} {selectedCount === 1 ? 'file' : 'files'} selected</span>
          {!loading && <span className="mega-picker-size">{formatSize(selectedSize)}</span>}
        </div>
        <div className="action-buttons">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onDismiss}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onConfirm(selectedFiles.map(f => f.link))}
            disabled={selectedCount === 0}
          >
            Add {selectedCount > 0 ? `${selectedCount} ` : ''}{selectedCount === 1 ? 'File' : 'Files'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MegaFolderPicker;
