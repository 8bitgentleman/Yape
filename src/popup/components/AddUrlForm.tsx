import React, { useState } from 'react';
import { isMegaFolderLink, getFolderContents, FolderFile } from '../../common/api/megaFolder';
import MegaFolderPicker from './MegaFolderPicker';

interface AddUrlFormProps {
  onAddDownload: (url: string, path?: string) => void;
  onAddLinks?: (links: string[], name?: string) => void;
  onCancel: () => void;
}

const AddUrlForm: React.FC<AddUrlFormProps> = ({ onAddDownload, onAddLinks, onCancel }) => {
  const [url, setUrl] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [ftpUsername, setFtpUsername] = useState<string>('');
  const [ftpPassword, setFtpPassword] = useState<string>('');
  const [unzipPassword, setUnzipPassword] = useState<string>('');

  // MEGA folder review state
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);
  const [folderLoading, setFolderLoading] = useState<boolean>(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  const trimmedUrl = url.trim();
  const isMega = isMegaFolderLink(trimmedUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = url.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length > 0) {
      urls.forEach(u => onAddDownload(u));
    }
  };

  const handleReview = async () => {
    if (!trimmedUrl || !isMega) return;

    setFolderError(null);
    setFolderFiles([]);
    setFolderLoading(true);
    setShowPicker(true);

    try {
      const files = await getFolderContents(trimmedUrl);
      if (files.length === 1) {
        // Single file — skip picker, submit directly
        setShowPicker(false);
        if (onAddLinks) {
          onAddLinks([files[0].link]);
        } else {
          onAddDownload(files[0].link);
        }
      } else {
        setFolderFiles(files);
      }
    } catch (err) {
      setShowPicker(false);
      setFolderError(err instanceof Error ? err.message : 'Failed to fetch folder contents');
    } finally {
      setFolderLoading(false);
    }
  };

  const handlePickerConfirm = (selectedLinks: string[]) => {
    if (selectedLinks.length === 0) return;
    setShowPicker(false);
    if (onAddLinks) {
      onAddLinks(selectedLinks, 'MEGA Folder Download');
    } else {
      selectedLinks.forEach(link => onAddDownload(link));
    }
  };

  const handlePickerDismiss = () => {
    setShowPicker(false);
    setFolderFiles([]);
    setFolderLoading(false);
  };

  if (showPicker) {
    return (
      <MegaFolderPicker
        files={folderFiles}
        loading={folderLoading}
        folderName={trimmedUrl.match(/\/folder\/([^#]+)/)?.[1]}
        onConfirm={handlePickerConfirm}
        onDismiss={handlePickerDismiss}
      />
    );
  }

  return (
    <div className="add-url-form">
      <form onSubmit={handleSubmit}>
        <div className="url-input-area">
          <textarea
            placeholder="URL(s) to download (one per line)..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            rows={4}
            required
          />
        </div>

        {folderError && (
          <div className="alert alert-danger py-1 px-2 mb-2" style={{ fontSize: '0.75rem' }}>
            <i className="fas fa-exclamation-triangle me-1" />{folderError}
          </div>
        )}

        {/* Advanced Options Toggle */}
        <div className="advanced-options-toggle mb-3">
          <div
            className="selected-path d-flex justify-content-between align-items-center"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <div>
              <i className="fas fa-cog me-2"></i>
              Advanced Options
            </div>
            <i className={`fas fa-chevron-${showAdvanced ? 'up' : 'down'}`}></i>
          </div>
        </div>

        {showAdvanced && (
          <div className="advanced-options mb-3">
            <div className="form-row">
              <input
                type="text"
                placeholder="FTP username..."
                className="form-control mb-2"
                value={ftpUsername}
                onChange={(e) => setFtpUsername(e.target.value)}
              />
            </div>
            <div className="form-row">
              <input
                type="password"
                placeholder="FTP password..."
                className="form-control mb-2"
                value={ftpPassword}
                onChange={(e) => setFtpPassword(e.target.value)}
              />
            </div>
            <div className="form-row">
              <input
                type="password"
                placeholder="Unzip password..."
                className="form-control"
                value={unzipPassword}
                onChange={(e) => setUnzipPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="action-buttons mt-3">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>

          {isMega && onAddLinks && (
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={handleReview}
              disabled={!trimmedUrl}
            >
              <i className="fas fa-list me-1" />
              Review
            </button>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!trimmedUrl}
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddUrlForm;
