# Step 6.3: File Management Frontend

## Overview

Implement comprehensive file management system frontend with drag-and-drop uploads, file previews, sharing controls, and integration with multiple storage providers.

## Implementation Details

### 1. File Upload Component

```typescript
// src/components/files/FileUpload.tsx
interface FileUploadProps {
  onUpload: (files: File[]) => Promise<UploadResult[]>;
  acceptedTypes?: string[];
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  acceptedTypes = ['*/*'],
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  multiple = true,
  disabled = false,
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (disabled || uploading) return;

    // Validate files
    const validFiles = validateFiles(files);
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      // Create upload sessions for each file
      const uploadPromises = validFiles.map(async (file) => {
        const fileId = crypto.randomUUID();
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

        return uploadFileWithProgress(file, (progress) => {
          setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
        });
      });

      const results = await Promise.all(uploadPromises);
      await onUpload(results);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  const validateFiles = (files: File[]): File[] => {
    return files.filter(file => {
      // Check file type
      if (!acceptedTypes.includes('*/*') && 
          !acceptedTypes.some(type => file.type.includes(type))) {
        showNotification({
          type: 'error',
          message: `File type ${file.type} not supported`
        });
        return false;
      }

      // Check file size
      if (file.size > maxSize) {
        showNotification({
          type: 'error',
          message: `File ${file.name} is too large (max ${formatBytes(maxSize)})`
        });
        return false;
      }

      return true;
    }).slice(0, maxFiles);
  };

  const uploadFileWithProgress = async (
    file: File, 
    onProgress: (progress: number) => void
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', '/api/files/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${getAuthToken()}`);
      xhr.send(formData);
    });
  };

  return (
    <div className="relative">
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragOver 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        {children || (
          <div className="space-y-2">
            <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto" />
            <div className="text-lg font-medium text-gray-900">
              {isDragOver ? 'Drop files here' : 'Upload files'}
            </div>
            <div className="text-sm text-gray-500">
              Drag and drop files here, or click to select
            </div>
            <div className="text-xs text-gray-400">
              Max {maxFiles} files, {formatBytes(maxSize)} each
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        disabled={disabled}
      />

      {uploading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <div className="mt-2 text-sm text-gray-600">
              Uploading files...
            </div>
            {Object.values(uploadProgress).length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                {Math.round(
                  Object.values(uploadProgress).reduce((a, b) => a + b, 0) / 
                  Object.values(uploadProgress).length
                )}% complete
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

### 2. File Manager Component

```typescript
// src/components/files/FileManager.tsx
export const FileManager: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await apiService.files.getFiles({
        type: filterType === 'all' ? undefined : filterType,
        search: searchQuery || undefined,
        sortBy,
        order: 'desc'
      });
      setFiles(response.files);
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to load files'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (uploadedFiles: UploadResult[]) => {
    // Add uploaded files to the list
    const newFiles = uploadedFiles.map(result => ({
      id: result.id,
      name: result.originalName,
      size: result.size,
      type: result.mimeType,
      url: result.url,
      createdAt: new Date().toISOString(),
      createdBy: 'current-user'
    }));
    
    setFiles(prev => [...newFiles, ...prev]);
    showNotification({
      type: 'success',
      message: `${uploadedFiles.length} file(s) uploaded successfully`
    });
  };

  const handleFileDelete = async (fileIds: string[]) => {
    try {
      await Promise.all(
        fileIds.map(id => apiService.files.deleteFile(id))
      );
      setFiles(prev => prev.filter(file => !fileIds.includes(file.id)));
      setSelectedFiles([]);
      showNotification({
        type: 'success',
        message: `${fileIds.length} file(s) deleted`
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to delete files'
      });
    }
  };

  const handleFileShare = async (fileId: string) => {
    try {
      const shareLink = await apiService.files.createShareLink(fileId);
      navigator.clipboard.writeText(shareLink.url);
      showNotification({
        type: 'success',
        message: 'Share link copied to clipboard'
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to create share link'
      });
    }
  };

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(file => 
        file.type.startsWith(filterType)
      );
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort files
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [files, filterType, searchQuery, sortBy]);

  return (
    <div className="h-full flex flex-col">
      <FileManagerHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortChange={setSortBy}
        filterType={filterType}
        onFilterChange={setFilterType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCount={selectedFiles.length}
        onDelete={() => handleFileDelete(selectedFiles)}
        onDeselectAll={() => setSelectedFiles([])}
      />

      <div className="flex-1 overflow-hidden">
        <div className="h-full p-4">
          <FileUpload
            onUpload={handleFileUpload}
            maxFiles={10}
            maxSize={50 * 1024 * 1024} // 50MB
          />

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <FileGrid
                files={filteredAndSortedFiles}
                viewMode={viewMode}
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
                onFileShare={handleFileShare}
                onFileDelete={(fileId) => handleFileDelete([fileId])}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 3. File Grid Component

```typescript
// src/components/files/FileGrid.tsx
interface FileGridProps {
  files: FileItem[];
  viewMode: 'grid' | 'list';
  selectedFiles: string[];
  onSelectionChange: (selectedFiles: string[]) => void;
  onFileShare: (fileId: string) => void;
  onFileDelete: (fileId: string) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  viewMode,
  selectedFiles,
  onSelectionChange,
  onFileShare,
  onFileDelete
}) => {
  const handleFileSelect = (fileId: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedFiles, fileId]);
    } else {
      onSelectionChange(selectedFiles.filter(id => id !== fileId));
    }
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(files.map(file => file.id));
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center">
          <input
            type="checkbox"
            checked={selectedFiles.length === files.length && files.length > 0}
            onChange={handleSelectAll}
            className="mr-3"
          />
          <div className="flex-1 grid grid-cols-4 gap-4 text-sm font-medium text-gray-700">
            <div>Name</div>
            <div>Size</div>
            <div>Modified</div>
            <div>Actions</div>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {files.map((file) => (
            <FileListItem
              key={file.id}
              file={file}
              selected={selectedFiles.includes(file.id)}
              onSelect={(selected) => handleFileSelect(file.id, selected)}
              onShare={() => onFileShare(file.id)}
              onDelete={() => onFileDelete(file.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {files.map((file) => (
        <FileGridItem
          key={file.id}
          file={file}
          selected={selectedFiles.includes(file.id)}
          onSelect={(selected) => handleFileSelect(file.id, selected)}
          onShare={() => onFileShare(file.id)}
          onDelete={() => onFileDelete(file.id)}
        />
      ))}
    </div>
  );
};
```

### 4. File Preview Component

```typescript
// src/components/files/FilePreview.tsx
interface FilePreviewProps {
  file: FileItem;
  isOpen: boolean;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <DocumentIcon className="w-16 h-16 mb-4" />
          <p>Preview not available</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (file.type.startsWith('image/')) {
      return (
        <ImagePreview
          src={file.url}
          alt={file.name}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load image');
          }}
        />
      );
    }

    if (file.type.startsWith('video/')) {
      return (
        <VideoPreview
          src={file.url}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load video');
          }}
        />
      );
    }

    if (file.type === 'application/pdf') {
      return (
        <PDFPreview
          src={file.url}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load PDF');
          }}
        />
      );
    }

    if (file.type.startsWith('text/') || 
        file.type.includes('json') || 
        file.type.includes('javascript')) {
      return (
        <TextPreview
          src={file.url}
          fileName={file.name}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load text file');
          }}
        />
      );
    }

    // Default fallback
    setLoading(false);
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <DocumentIcon className="w-16 h-16 mb-4" />
        <p>Preview not available for this file type</p>
        <Button
          className="mt-4"
          onClick={() => window.open(file.url, '_blank')}
        >
          Download File
        </Button>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.name}
      size="xl"
      footer={
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => window.open(file.url, '_blank')}
          >
            Download
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-auto">
        {renderPreview()}
      </div>
      
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Size:</span>
            <span className="ml-2">{formatBytes(file.size)}</span>
          </div>
          <div>
            <span className="font-medium">Type:</span>
            <span className="ml-2">{file.type}</span>
          </div>
          <div>
            <span className="font-medium">Created:</span>
            <span className="ml-2">{formatDate(file.createdAt)}</span>
          </div>
          <div>
            <span className="font-medium">Modified:</span>
            <span className="ml-2">{formatDate(file.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
```

### 5. File Sharing Component

```typescript
// src/components/files/FileSharing.tsx
interface FileSharingProps {
  file: FileItem;
  isOpen: boolean;
  onClose: () => void;
}

export const FileSharing: React.FC<FileSharingProps> = ({
  file,
  isOpen,
  onClose
}) => {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLink, setNewLink] = useState({
    expiresAt: '',
    maxDownloads: '',
    password: '',
    allowPreview: true
  });

  useEffect(() => {
    if (isOpen) {
      loadShareLinks();
    }
  }, [isOpen]);

  const loadShareLinks = async () => {
    setLoading(true);
    try {
      const links = await apiService.files.getShareLinks(file.id);
      setShareLinks(links);
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to load share links'
      });
    } finally {
      setLoading(false);
    }
  };

  const createShareLink = async () => {
    try {
      const link = await apiService.files.createShareLink(file.id, {
        expiresAt: newLink.expiresAt || undefined,
        maxDownloads: newLink.maxDownloads ? parseInt(newLink.maxDownloads) : undefined,
        password: newLink.password || undefined,
        allowPreview: newLink.allowPreview
      });
      
      setShareLinks(prev => [...prev, link]);
      setNewLink({
        expiresAt: '',
        maxDownloads: '',
        password: '',
        allowPreview: true
      });
      
      showNotification({
        type: 'success',
        message: 'Share link created successfully'
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to create share link'
      });
    }
  };

  const deleteShareLink = async (linkId: string) => {
    try {
      await apiService.files.deleteShareLink(linkId);
      setShareLinks(prev => prev.filter(link => link.id !== linkId));
      showNotification({
        type: 'success',
        message: 'Share link deleted'
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to delete share link'
      });
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    showNotification({
      type: 'success',
      message: 'Link copied to clipboard'
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${file.name}"`}
      size="lg"
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Create New Share Link</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Expires At"
                type="datetime-local"
                value={newLink.expiresAt}
                onChange={(e) => setNewLink(prev => ({ 
                  ...prev, 
                  expiresAt: e.target.value 
                }))}
              />
              <Input
                label="Max Downloads"
                type="number"
                min="1"
                value={newLink.maxDownloads}
                onChange={(e) => setNewLink(prev => ({ 
                  ...prev, 
                  maxDownloads: e.target.value 
                }))}
              />
            </div>
            <Input
              label="Password (optional)"
              type="password"
              value={newLink.password}
              onChange={(e) => setNewLink(prev => ({ 
                ...prev, 
                password: e.target.value 
              }))}
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allowPreview"
                checked={newLink.allowPreview}
                onChange={(e) => setNewLink(prev => ({ 
                  ...prev, 
                  allowPreview: e.target.checked 
                }))}
                className="mr-2"
              />
              <label htmlFor="allowPreview" className="text-sm">
                Allow preview without download
              </label>
            </div>
            <Button onClick={createShareLink}>
              Create Share Link
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Existing Share Links</h3>
          {loading ? (
            <LoadingSpinner />
          ) : shareLinks.length === 0 ? (
            <p className="text-gray-500">No share links created yet</p>
          ) : (
            <div className="space-y-3">
              {shareLinks.map((link) => (
                <ShareLinkItem
                  key={link.id}
                  link={link}
                  onCopy={() => copyToClipboard(link.url)}
                  onDelete={() => deleteShareLink(link.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
```

## File Management Features

### 1. Upload System

- Drag and drop interface
- Progress tracking
- Chunked uploads for large files
- Resume interrupted uploads

### 2. File Organization

- Grid and list view modes
- Sorting and filtering
- Search functionality
- Bulk operations

### 3. Preview System

- Image previews with zoom
- Video player with controls
- PDF viewer integration
- Text file syntax highlighting

### 4. Sharing Controls

- Secure share links
- Expiration dates
- Download limits
- Password protection

## Integration Points

- Chat system for file attachments
- Storage providers (S3, Google Cloud, Azure)
- Authentication for access control
- WebSocket for real-time updates

## Performance Optimizations

### 1. Upload Performance

- Chunked uploads
- Parallel processing
- Compression before upload
- Progress feedback

### 2. Display Performance

- Virtual scrolling for large lists
- Lazy loading of thumbnails
- Efficient image optimization
- Cache management

## Security Features

### 1. Access Control

- User-based permissions
- Share link validation
- Download tracking
- Audit logging

### 2. File Validation

- Type restrictions
- Size limits
- Malware scanning
- Content validation

## Next Steps

- Step 6.4: Frontend testing implementation
- Advanced file features
- Mobile optimizations
- Offline capabilities
