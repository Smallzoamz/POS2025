import React, { useState, useEffect } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { api } from './services/api';
import { useAuth } from './contexts/AuthContext';

const MenuManagement = () => {
    const { user } = useAuth(); // Get User for permissions
    const isOwner = user?.role === 'owner'; // Only Owner can edit

    const [activeTab, setActiveTab] = useState('products'); // products | categories
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showProductModal, setShowProductModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('info');
    const [productForm, setProductForm] = useState({ name: '', price: 0, category_id: '', image: '', is_available: true, track_stock: 0, stock_quantity: 0 });
    const [categoryForm, setCategoryForm] = useState({ id: '', name: '', icon: '' });
    const [allIngredients, setAllIngredients] = useState([]);
    const [recipeItems, setRecipeItems] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [menuRes, ingRes] = await Promise.all([
                api.getMenu(),
                api.getIngredients()
            ]);
            setProducts(menuRes.products);
            setCategories(menuRes.categories);
            setAllIngredients(ingRes);

            // Set default category if any
            if (menuRes.categories.length > 0 && !productForm.category_id) {
                setProductForm(prev => ({ ...prev, category_id: menuRes.categories[0].id }));
            }
        } catch (error) {
            console.error("Error loading menu data:", error);
        } finally {
            setLoading(false);
        }
    };

    const openProductModal = async (product = null) => {
        setEditingProduct(product);
        setActiveModalTab('info');
        if (product) {
            setProductForm({ ...product });
            // Fetch recipe if editing
            try {
                const recipe = await api.getProductRecipe(product.id);
                setRecipeItems(recipe);
            } catch (e) {
                console.error("Error loading recipe:", e);
                setRecipeItems([]);
            }
        } else {
            setProductForm({
                name: '',
                price: 0,
                category_id: categories[0]?.id || '',
                image: '',
                is_available: true,
                track_stock: 0,
                stock_quantity: 0
            });
            setRecipeItems([]);
        }
        setShowProductModal(true);
    };

    const handleProductSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                await api.updateProduct(editingProduct.id, productForm);
            } else {
                await api.addProduct(productForm);
            }
            setShowProductModal(false);
            loadData();
        } catch (error) {
            console.error("Error saving product:", error);
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await api.deleteProduct(id);
            loadData();
        } catch (error) {
            console.error("Error deleting product:", error);
        }
    };

    const handleToggleAvailability = async (product) => {
        try {
            const newStatus = !product.is_available;
            // Optimistic update
            setProducts(products.map(p => p.id === product.id ? { ...p, is_available: newStatus } : p));

            // Send full product object to satisfy DB NOT NULL constraints
            await api.updateProduct(product.id, { ...product, is_available: newStatus });
        } catch (error) {
            console.error("Error toggling availability:", error);
            // Rollback on error
            loadData();
        }
    };

    const openCategoryModal = () => {
        setCategoryForm({ id: '', name: '', icon: '' });
        setShowCategoryModal(true);
    };

    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        try {
            await api.addCategory(categoryForm);
            setShowCategoryModal(false);
            loadData();
        } catch (error) {
            console.error("Error saving category:", error);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('Are you sure? This might affect products in this category.')) return;
        try {
            await api.deleteCategory(id);
            loadData();
        } catch (error) {
            console.error("Error deleting category:", error);
        }
    };

    const handleSaveRecipe = async () => {
        if (!editingProduct) return;
        try {
            await api.updateProductRecipe(editingProduct.id, recipeItems);
            setShowProductModal(false);
            alert("✅ บันทึกสูตรอาหารเรียบร้อยแล้ว");
        } catch (error) {
            console.error("Error saving recipe:", error);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกสูตร");
        }
    };

    return (
        <MasterLayout title="คลังสินค้า & เมนู">
            <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pt-4">
                {/* Modern Tab Navigation */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-[28px] w-fit shadow-inner">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`flex items-center gap-3 px-8 py-3.5 rounded-[22px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === 'products'
                                ? 'bg-white text-orange-600 shadow-md ring-1 ring-orange-500/10'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                }`}
                        >
                            📦 <span className="hidden sm:inline">Product</span> Assets
                        </button>
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-[22px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === 'categories'
                                ? 'bg-white text-orange-600 shadow-md ring-1 ring-orange-500/10'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                }`}
                        >
                            📁 <span className="hidden sm:inline">Category</span> Matrix
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {isOwner && (
                            <button
                                onClick={() => activeTab === 'products' ? openProductModal() : openCategoryModal()}
                                className="group relative px-8 py-4 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] overflow-hidden transition-all hover:scale-[1.05] hover:shadow-2xl active:scale-95 shadow-xl"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                <span className="relative flex items-center gap-3">
                                    <span className="text-lg">+</span>
                                    {activeTab === 'products' ? 'Create New Asset' : 'New Category'}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="relative">
                    {activeTab === 'products' ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Inventory <span className="text-orange-600">Assets</span></h2>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Total {products.length} Items Registered</p>
                                </div>
                            </div>

                            <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#F8FAFC]">
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Visual</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Name & Category</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unit Value</th>
                                                {isOwner && <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {products.map(p => {
                                                const cat = categories.find(c => c.id === p.category_id);
                                                return (
                                                    <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-8 py-6">
                                                            <div className="w-16 h-16 bg-slate-100 rounded-[22px] overflow-hidden border border-slate-100 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                                                                {p.image ? (
                                                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-2xl grayscale group-hover:grayscale-0 transition-all">📷</div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <div className="font-black text-slate-900 text-lg tracking-tight mb-1">{p.name}</div>
                                                            <span className="inline-block px-3 py-1 bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-full border border-slate-200">
                                                                {cat ? cat.name : p.category_id}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-6 text-center">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div
                                                                    onClick={() => handleToggleAvailability(p)}
                                                                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all duration-300 ${p.is_available ? 'bg-orange-500' : 'bg-slate-300'}`}
                                                                >
                                                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${p.is_available ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                                                </div>
                                                                <span className={`text-[9px] font-black uppercase tracking-tighter ${p.is_available ? 'text-orange-600' : 'text-slate-400'}`}>
                                                                    {p.is_available ? 'Available' : 'Sold Out'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <div className={`text-xl font-black tabular-nums tracking-tighter ${p.is_available ? 'text-orange-600' : 'text-slate-300'}`}>
                                                                ฿{p.price.toLocaleString()}
                                                            </div>
                                                        </td>
                                                        {isOwner && (
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center justify-center gap-3">
                                                                    <button
                                                                        onClick={() => openProductModal(p)}
                                                                        className="w-10 h-10 bg-slate-50 hover:bg-orange-50 text-slate-400 hover:text-orange-500 rounded-2xl transition-all flex items-center justify-center border border-slate-100"
                                                                        title="Edit Asset"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteProduct(p.id)}
                                                                        className="w-10 h-10 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all flex items-center justify-center border border-slate-100"
                                                                        title="Delete Asset"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="px-2">
                                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Category <span className="text-orange-600">Matrix</span></h2>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Foundational Product Groups</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                {categories.map(c => (
                                    <div key={c.id} className="group bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-500 relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 rounded-full group-hover:bg-orange-50 transition-colors"></div>
                                        <div className="relative">
                                            <div className="text-5xl mb-6 text-slate-800 group-hover:scale-125 transition-transform duration-500 flex justify-center">{c.icon || '📁'}</div>
                                            <div className="text-center mb-6">
                                                <h3 className="font-black text-xl text-slate-900 tracking-tight">{c.name}</h3>
                                                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Matrix Code: {c.id}</p>
                                            </div>

                                            {isOwner && (
                                                <button
                                                    onClick={() => handleDeleteCategory(c.id)}
                                                    className="w-full py-3 bg-slate-50 group-hover:bg-red-50 text-[10px] font-black text-slate-400 group-hover:text-red-500 uppercase tracking-widest rounded-2xl transition-all border border-slate-100 flex items-center justify-center gap-2"
                                                >
                                                    🗑️ Terminate Group
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Glassmorphism Product Modal */}
                {showProductModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowProductModal(false)}>
                        <div className="bg-white rounded-[48px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up relative border border-white" onClick={e => e.stopPropagation()}>
                            <div className="h-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>

                            <div className="px-10 py-10 bg-[#f8fafc] border-b border-slate-100">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {editingProduct ? 'Update Asset' : 'Create New Asset'}
                                    </h3>
                                    <button
                                        onClick={() => setShowProductModal(false)}
                                        className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-300 hover:text-slate-600 flex items-center justify-center transition-all"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex gap-2 mt-6 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200 shadow-inner">
                                    <button
                                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeModalTab === 'info' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                                        onClick={() => setActiveModalTab('info')}
                                    >
                                        Core Profile
                                    </button>
                                    <button
                                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeModalTab === 'recipe' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                                        onClick={() => setActiveModalTab('recipe')}
                                    >
                                        Culinary Blueprint
                                    </button>
                                </div>
                            </div>

                            <div className="px-8 py-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                                {activeModalTab === 'info' ? (
                                    <form id="product-form" onSubmit={handleProductSubmit} className="space-y-5">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-l-4 border-l-orange-500">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Asset Registration Name</label>
                                            <input
                                                type="text" required placeholder="Asset title..."
                                                className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:text-slate-300"
                                                value={productForm.name}
                                                onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-l-4 border-l-blue-500">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Market Value (฿)</label>
                                                <input
                                                    type="number" required
                                                    className="w-full bg-transparent text-base font-bold text-slate-900 outline-none placeholder:text-slate-300 tabular-nums"
                                                    value={productForm.price}
                                                    onChange={e => setProductForm({ ...productForm, price: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-l-4 border-l-emerald-500">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Matrix Placement</label>
                                                <select
                                                    className="w-full bg-transparent text-base font-bold text-slate-900 outline-none cursor-pointer"
                                                    value={productForm.category_id}
                                                    onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                                                >
                                                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-l-4 border-l-amber-500">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Visual Asset URL</label>
                                            <input
                                                type="text" placeholder="https://resource-path.com/image.jpg"
                                                className="w-full bg-transparent text-sm font-medium text-slate-600 outline-none placeholder:text-slate-300"
                                                value={productForm.image}
                                                onChange={e => setProductForm({ ...productForm, image: e.target.value })}
                                            />
                                        </div>
                                    </form>
                                ) : (

                                    <div className="space-y-8 animate-fade-in">
                                        <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 text-orange-800 text-[11px] font-bold">
                                            <span className="text-lg">ℹ️</span> Define ingredient ratios for automated stock depletion upon transaction.
                                        </div>

                                        {/* Precision Entry */}
                                        <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent"></div>
                                            <div className="relative z-10 space-y-6">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Precision Entry Mechanism</label>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <select
                                                        className="w-full bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 ring-orange-500/50 backdrop-blur-sm"
                                                        id="ing-select"
                                                        onChange={(e) => {
                                                            const ingId = Number(e.target.value);
                                                            const ing = allIngredients.find(i => i.id === ingId);
                                                            const unitSelect = document.getElementById('unit-select');
                                                            if (ing) {
                                                                if (ing.unit === 'kg') unitSelect.innerHTML = '<option value="kg">kg</option><option value="g">g</option>';
                                                                else if (ing.unit === 'l') unitSelect.innerHTML = '<option value="l">l</option><option value="ml">ml</option>';
                                                                else unitSelect.innerHTML = `<option value="${ing.unit}">${ing.unit}</option>`;
                                                            } else unitSelect.innerHTML = '<option value="units">-</option>';
                                                        }}
                                                    >
                                                        <option value="">-- Select Key Ingredient --</option>
                                                        {allIngredients.map(ing => (
                                                            <option key={ing.id} value={ing.id}>{ing.name} ({ing.total_quantity} {ing.unit})</option>
                                                        ))}
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <input type="number" step="any" className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 ring-orange-500/50" id="ing-qty" placeholder="Quantity..." />
                                                        <select id="unit-select" className="w-24 bg-white/20 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest outline-none">
                                                            <option value="units">-</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const select = document.getElementById('ing-select');
                                                        const qtyInput = document.getElementById('ing-qty');
                                                        const unitSelect = document.getElementById('unit-select');
                                                        const ingId = Number(select.value);
                                                        let qty = parseFloat(qtyInput.value);
                                                        const selectedUnit = unitSelect.value;
                                                        if (ingId && qty > 0) {
                                                            const ing = allIngredients.find(i => i.id === ingId);
                                                            let finalQty = qty;
                                                            if (ing.unit === 'kg' && selectedUnit === 'g') finalQty = qty / 1000;
                                                            else if (ing.unit === 'l' && selectedUnit === 'ml') finalQty = qty / 1000;
                                                            setRecipeItems([...recipeItems, { ingredient_id: ingId, name: ing.name, unit: ing.unit, quantity_used: finalQty }]);
                                                            select.value = ""; qtyInput.value = ""; unitSelect.innerHTML = '<option value="units">-</option>';
                                                        }
                                                    }}
                                                    className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-xl shadow-orange-500/20 active:scale-[0.98]"
                                                >
                                                    Integrate Component +
                                                </button>
                                            </div>
                                        </div>

                                        {/* Active Blueprint */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Active Culinary Matrix</h4>
                                            <div className="bg-slate-50 border border-slate-100 rounded-[32px] overflow-hidden shadow-inner">
                                                {recipeItems.length > 0 ? (
                                                    <div className="divide-y divide-slate-100">
                                                        {recipeItems.map((item, index) => (
                                                            <div key={index} className="flex items-center justify-between p-6 group/item hover:bg-white transition-colors">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-[10px]">🧊</div>
                                                                    <span className="font-black text-slate-800 tracking-tight">{item.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-6">
                                                                    <span className="text-orange-600 font-black tabular-nums">{item.quantity_used} <span className="text-slate-400 text-[10px] uppercase">{item.unit}</span></span>
                                                                    <button
                                                                        onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}
                                                                        className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                                                                    >✕</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-20 text-center text-slate-300">
                                                        <span className="text-4xl block mb-4 grayscale opacity-20">📐</span>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Blueprint Empty</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="px-10 py-8 bg-[#f8fafc] border-t border-slate-100 flex gap-4">
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-8 py-5 bg-white border border-slate-200 text-slate-900 rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex-1 shadow-sm">
                                    Abort
                                </button>
                                <button
                                    onClick={activeModalTab === 'recipe' ? handleSaveRecipe : () => document.getElementById('product-form').requestSubmit()}
                                    className="px-8 py-5 bg-slate-900 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex-1 shadow-xl relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    {activeModalTab === 'recipe' ? 'Commit Blueprint' : 'Authorize Records'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Modal */}
                {showCategoryModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCategoryModal(false)}>
                        <div className="bg-white rounded-[48px] w-full max-w-sm shadow-2xl animate-fade-in-up relative border border-white overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="h-2 bg-gradient-to-r from-slate-700 to-slate-900"></div>
                            <div className="px-10 py-10">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-8">Define <span className="text-orange-600">New Matrix</span></h3>
                                <form onSubmit={handleCategorySubmit} className="space-y-8">
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Matrix Identifier (ID)</label>
                                        <input
                                            type="text" required placeholder="DEPT_CODE"
                                            className="w-full bg-transparent text-xl font-black text-slate-900 outline-none placeholder:text-slate-300 uppercase tracking-widest"
                                            value={categoryForm.id}
                                            onChange={e => setCategoryForm({ ...categoryForm, id: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Display Designation</label>
                                        <input
                                            type="text" required placeholder="Human readable title..."
                                            className="w-full bg-transparent text-xl font-black text-slate-900 outline-none placeholder:text-slate-300"
                                            value={categoryForm.name}
                                            onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner flex flex-col items-center">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Visual Iconography</label>
                                        <input
                                            type="text" required placeholder="📁"
                                            className="w-20 h-20 bg-white shadow-md border border-slate-100 rounded-[28px] text-center text-4xl outline-none focus:ring-4 ring-orange-500/10"
                                            value={categoryForm.icon}
                                            onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 px-4 py-4 bg-white border border-slate-200 text-slate-900 rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-sm">Cancel</button>
                                        <button type="submit" className="flex-1 px-4 py-4 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all">Establish</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MasterLayout>
    );
};

export default MenuManagement;
