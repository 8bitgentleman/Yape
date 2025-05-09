import React from 'react';

interface AddCurrentPageProps {
  url: string;
  onAddDownload: () => void;
}

/**
 * Component to add current page to downloads
 */
const AddCurrentPage: React.FC<AddCurrentPageProps> = ({
  url,
  onAddDownload
}) => {
  return (
    <div className="card mb-3">
      <div className="card-body">
        <h5 className="card-title">Download Current Page</h5>
        <p className="card-text small text-muted ellipsis mb-2">
          {url}
        </p>
        <button
          className="btn btn-primary btn-sm w-100"
          onClick={onAddDownload}
        >
          <i className="fas fa-download me-1"></i> Download
        </button>
      </div>
    </div>
  );
};

export default AddCurrentPage;
