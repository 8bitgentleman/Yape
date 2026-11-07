import React, { useState } from 'react';
import { isMegaFolderLink, getFolderContents, FolderFile } from '../../common/api/megaFolder';
import MegaFolderPicker from './MegaFolderPicker';
import { decodeBase64Urls, extractUrlsWithBase64 } from '../../common/utils/base64Url';

interface AddUrlFormProps {
  onAddDownload: (url: string, path?: string) => void;
  onAddLinks?: (links: string[], name?: string) => void;
  onCancel: () => void;
  initialText?: string;
}

const AddUrlForm: React.FC<AddUrlFormProps> = ({ onAddDownload, onAddLinks, onCancel, initialText }) => {
  const [url, setUrl] = useState<string>(initialText ?? '');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [ftpUsername, setFtpUsername] = useState<string>('');
  const [ftpPassword, setFtpPassword] = useState<string>('');
  const [unzipPassword, setUnzipPassword] = useState<string>('');

  // MEGA folder review state
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [folderFiles, setFolderFiles] = useState<FolderFile[]>([]);
  const [folderLoading, setFolderLoading] = useState<boolean>(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // Each line may be a plain URL or a base64-encoded one; decode the latter.
  const lines = url.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  const isPlainUrl = (line: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(line);
  const perLine = lines.flatMap(line => {
    if (isPlainUrl(line)) return [{ value: line, decoded: false }];
    const decodedUrls = decodeBase64Urls(line);
    return decodedUrls.length > 0
      ? decodedUrls.map(value => ({ value, decoded: true }))
      : [{ value: line, decoded: false }];
  });
  // Several lines and no plain URLs: they may be separate blobs or one blob wrapped
  // across lines, which the extractor tells apart.
  const wrapped = lines.length > 1 && !lines.some(isPlainUrl) ? extractUrlsWithBase64(url) : null;
  const resolved = wrapped?.decoded ? wrapped.urls.map(value => ({ value, decoded: true })) : perLine;
  const decodedCount = resolved.filter(r => r.decoded).length;

  const trimmedUrl = resolved.length === 1 ? resolved[0].value : url.trim();
  const isMega = isMegaFolderLink(trimmedUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolved.length > 0) {
      resolved.forEach(r => onAddDownload(r.value));
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
            placeholder="URL(s) to download (one per line, base64 links are decoded)..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            rows={4}
            required
          />
        </div>

        {decodedCount > 0 && (
          <div className="text-muted mb-2" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
            <i className="fas fa-unlock me-1" />
            Decoded from base64: {decodedCount === 1 ? resolved.find(r => r.decoded)?.value : `${decodedCount} links`}
          </div>
        )}

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
