import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../shared/AuthContext.jsx';
import { api } from '../shared/api.js';
import Button from '../shared/ui/Button.jsx';

export default function BulkStudentUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [excelFile, setExcelFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const handleExcelUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      setError('Please select an Excel file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    setError('');

    const formData = new FormData();
    formData.append('excel', excelFile);

    try {
      const response = await api.post('/admin/students/bulk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      setUploadResult(response.data);
    } catch (error) {
      setError(error?.response?.data?.message || 'Failed to upload Excel file');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setExcelFile(null);
    }
  };

  return (
    // Guard: only admins may access this page
    !user || user.role !== 'admin' ? <Navigate to="/login" replace /> : (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="outline" onClick={() => navigate('/admin')}>
                Back to Admin Dashboard
              </Button>
            </div>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleExcelUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Excel File (.xlsx, .xls)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setExcelFile(e.target.files[0])}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isUploading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Required columns: name, rollno, email, mobilenumber, rfidnumber, department, password
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {isUploading && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Uploading...</span>
                  <span className="text-sm text-gray-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!excelFile || isUploading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isUploading ? 'Uploading...' : 'Upload & Create Students'}
            </button>
          </form>

          {uploadResult && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-medium text-sm text-gray-900 mb-3">Upload Results</h3>
              <div className="text-sm space-y-2">
                <p className="text-green-600">✓ Created {uploadResult.createdCount} students</p>
                <p className="text-gray-600">Total processed: {uploadResult.totalProcessed}</p>
                {uploadResult.duplicates.length > 0 && (
                  <p className="text-amber-600">⚠ Duplicates skipped: {uploadResult.duplicates.length}</p>
                )}
                {uploadResult.errors.length > 0 && (
                  <p className="text-red-600">✗ Errors: {uploadResult.errors.length}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Excel File Format</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>Required columns:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code>name</code> - Student's full name</li>
              <li><code>rollno</code> - Student roll number</li>
              <li><code>email</code> - Student email address</li>
              <li><code>mobilenumber</code> - Student mobile number</li>
              <li><code>rfidnumber</code> - RFID card UID</li>
              <li><code>department</code> - Student's department</li>
              <li><code>password</code> - Initial password for the student</li>
            </ul>
            <p className="mt-4"><strong>Note:</strong> First row should contain column headers, data starts from second row.</p>
          </div>
        </div>
      </div>
    </div>
    )
  );
}
