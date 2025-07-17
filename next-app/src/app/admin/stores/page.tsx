"use client";
import { useState, useEffect } from 'react';
import { 
  Building, Plus, Edit, Trash, Check, X, AlertCircle, Clock
} from 'lucide-react';
import { useStoreStore, Store } from '@/stores/storeStore';
import { useBusinessTypeStore } from '@/stores/businessTypeStore';
import AppLayout from '@/app/appLayout/layout';

const StoreManagement = () => {
  const { stores, fetchStores, createStore, updateStore, deleteStore } = useStoreStore();
  const { businessTypes, fetchBusinessTypes } = useBusinessTypeStore();
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchStores(), fetchBusinessTypes()]);
      } catch (error) {
        console.error('データの取得に失敗しました:', error);
        alert('データの取得に失敗しました。ネットワーク接続とAPIサーバーの状態を確認してください。');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [fetchBusinessTypes, fetchStores]);
  
  // Handle add store
  const handleAddStore = async () => {
    if (!newStoreName.trim()) {
      alert('店舗名を入力してください。');
      return;
    }
    
    if (!selectedBusinessTypeId) {
      alert('業態を選択してください。');
      return;
    }
    
    try {
      await createStore(newStoreName, selectedBusinessTypeId);
      setNewStoreName('');
      setSelectedBusinessTypeId('');
      setShowAddModal(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert('店舗追加エラー: ' + err.message);
      } else {
        alert('店舗追加エラーが発生しました');
      }
    }
  };
  
  // Handle edit store
  const handleEditStore = async () => {
    if (!selectedStore || !newStoreName.trim()) {
      alert('店舗名を入力してください。');
      return;
    }
    
    if (!selectedBusinessTypeId) {
      alert('業態を選択してください。');
      return;
    }
    
    try {
      await updateStore(selectedStore.id, newStoreName, selectedBusinessTypeId);
      setSelectedStore(null);
      setNewStoreName('');
      setSelectedBusinessTypeId('');
      setShowEditModal(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert('店舗編集エラー: ' + err.message);
      } else {
        alert('店舗編集エラーが発生しました');
      }
    }
  };
  
  // Handle delete store
  const handleDeleteStore = async () => {
    if (!selectedStore) return;
    
    try {
      await deleteStore(selectedStore.id);
      setSelectedStore(null);
      setShowDeleteModal(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert('店舗削除エラー: ' + err.message);
      } else {
        alert('店舗削除エラーが発生しました');
      }
    }
  };
  
  // Open edit modal
  const openEditModal = (store: Store) => {
    setSelectedStore(store);
    setNewStoreName(store.name);
    setSelectedBusinessTypeId(store.businessTypeId || '');
    setShowEditModal(true);
  };
  
  // Open delete modal
  const openDeleteModal = (store: Store) => {
    setSelectedStore(store);
    setShowDeleteModal(true);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Clock className="animate-spin h-8 w-8 text-primary-600 mr-3" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-8">
        <div className="space-y-6 slide-up">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">店舗管理</h1>
            <button 
              onClick={() => {
                setNewStoreName('');
                setSelectedBusinessTypeId('');
                setShowAddModal(true);
              }}
              className="btn-primary flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              店舗を追加
            </button>
          </div>
          
          {stores.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">店舗がありません</h3>
              <p className="text-sm text-gray-600 mb-4">
                まだ店舗が登録されていません。新しい店舗を追加してください。
              </p>
              <button
                onClick={() => {
                  setNewStoreName('');
                  setSelectedBusinessTypeId('');
                  setShowAddModal(true);
                }}
                className="btn-primary inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                店舗を追加
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        店舗名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        業態
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        アクション
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stores
                      .sort((a, b) => {
                        // 業態名でソート（業態が設定されていない場合は最後に）
                        const businessTypeA = a.businessTypeName || 'zzz'; // 未設定は最後
                        const businessTypeB = b.businessTypeName || 'zzz';
                        return businessTypeA.localeCompare(businessTypeB, 'ja');
                      })
                      .map((store) => (
                      <tr key={store.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building className="h-5 w-5 text-gray-400 mr-3" />
                            <span className="text-sm font-medium text-gray-900">{store.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {store.businessTypeName || '未設定'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(store)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(store)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Add Store Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">新しい店舗を追加</h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="store-name" className="form-label">店舗名</label>
                  <input
                    type="text"
                    id="store-name"
                    className="form-input"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="店舗名を入力"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="business-type" className="form-label">業態 <span className="text-red-500">*</span></label>
                  <select
                    id="business-type"
                    className="form-input"
                    value={selectedBusinessTypeId}
                    onChange={(e) => setSelectedBusinessTypeId(e.target.value)}
                    required
                  >
                    <option value="">業態を選択してください</option>
                    {businessTypes.map((businessType) => (
                      <option key={businessType.id} value={businessType.id}>
                        {businessType.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-outline"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStore}
                    className="btn-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    追加する
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Edit Store Modal */}
          {showEditModal && selectedStore && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">店舗を編集</h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="store-name-edit" className="form-label">店舗名</label>
                  <input
                    type="text"
                    id="store-name-edit"
                    className="form-input"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="店舗名を入力"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="business-type-edit" className="form-label">業態 <span className="text-red-500">*</span></label>
                  <select
                    id="business-type-edit"
                    className="form-input"
                    value={selectedBusinessTypeId}
                    onChange={(e) => setSelectedBusinessTypeId(e.target.value)}
                    required
                  >
                    <option value="">業態を選択してください</option>
                    {businessTypes.map((businessType) => (
                      <option key={businessType.id} value={businessType.id}>
                        {businessType.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-outline"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleEditStore}
                    className="btn-primary"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    保存する
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Delete Store Modal */}
          {showDeleteModal && selectedStore && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 fade-in">
              <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl slide-up">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 bg-red-100 rounded-full p-2">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">店舗を削除</h3>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  「{selectedStore.name}」を削除しますか？この操作は取り消せません。
                </p>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="btn-outline"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteStore}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Trash className="h-4 w-4 mr-2 inline" />
                    削除する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default function Page() {
  return (
    <AppLayout>
      <StoreManagement />
    </AppLayout>
  );
}