import React, { useState, useEffect } from 'react';
import MasterLayout from './layouts/MasterLayout';
import { api } from './services/api';
import { useAuth } from './contexts/AuthContext';

const MenuManagement = () => {
    const { user } = useAuth(); // Get User for permissions
    const isOwner = user?.role === 'owner'; // Only Owner can edit

    const [activeTab, setActiveTab] = useState('products'); // products | categories | global-options
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Global Options State
    const [globalOptions, setGlobalOptions] = useState([]);
    const [showGlobalOptionModal, setShowGlobalOptionModal] = useState(false);
    const [editingGlobalOption, setEditingGlobalOption] = useState(null);
    const [globalOptionForm, setGlobalOptionForm] = useState({
        name: '',
        price_modifier: 0,
        is_size_option: false,
        stock_quantity: 0,
        recipe_multiplier: 1.00,
        category_ids: []
    });

    const [showProductModal, setShowProductModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('info');
    const [productForm, setProductForm] = useState({ name: '', price: 0, category_id: '', image: '', is_available: true, track_stock: 0, stock_quantity: 0, is_recommended: false });
    const [categoryForm, setCategoryForm] = useState({ id: '', name: '', icon: '' });
    const [allIngredients, setAllIngredients] = useState([]);
    const [recipeItems, setRecipeItems] = useState([]);
    const [productOptions, setProductOptions] = useState([]);
    const [optionForm, setOptionForm] = useState({ name: '', price_modifier: 0, is_size_option: false, stock_quantity: 0, recipe_multiplier: 1.00 });
    const [showOptionRecipeModal, setShowOptionRecipeModal] = useState(false);
    const [editingOptionRecipe, setEditingOptionRecipe] = useState(null);
    const [optionRecipeItems, setOptionRecipeItems] = useState([]);
    const [syncStatus, setSyncStatus] = useState({ loading: false, message: '', error: false });

    // Manual Sync to Website
    const handleSyncToWebsite = async () => {
        setSyncStatus({ loading: true, message: 'กำลังส่งเมนูไปยังเว็บไซต์...', error: false });
        try {
            const res = await fetch('/api/sync-menu-to-website', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setSyncStatus({ loading: false, message: `✅ ${data.message}`, error: false });
                setTimeout(() => setSyncStatus({ loading: false, message: '', error: false }), 5000);
            } else {
                setSyncStatus({ loading: false, message: `⚠️ ${data.error || 'ไม่สามารถ Sync ได้'}`, error: true });
            }
        } catch (err) {
            setSyncStatus({ loading: false, message: `❌ เกิดข้อผิดพลาด: ${err.message}`, error: true });
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [menuRes, ingRes, globalOptsRes] = await Promise.all([
                api.getMenu(),
                api.getIngredients(),
                api.getGlobalOptions()
            ]);
            setProducts(menuRes.products);
            setCategories(menuRes.categories);
            setAllIngredients(ingRes);
            setGlobalOptions(globalOptsRes || []);

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

    const [globalOptionRecipeItems, setGlobalOptionRecipeItems] = useState([]);

    // --- GLOBAL OPTIONS CRUD ---
    const openGlobalOptionModal = async (option = null) => {
        setEditingGlobalOption(option);
        if (option) {
            setGlobalOptionForm({
                name: option.name,
                price_modifier: option.price_modifier,
                is_size_option: option.is_size_option,
                stock_quantity: option.stock_quantity,
                recipe_multiplier: option.recipe_multiplier,
                category_ids: option.category_ids || []
            });
            // Fetch existing recipe
            try {
                const recipe = await api.getGlobalOptionRecipe(option.id);
                setGlobalOptionRecipeItems(recipe || []);
            } catch (error) {
                console.error("Error loading option recipe:", error);
                setGlobalOptionRecipeItems([]);
            }
        } else {
            setGlobalOptionForm({
                name: '',
                price_modifier: 0,
                is_size_option: false,
                stock_quantity: 0,
                recipe_multiplier: 1.00,
                category_ids: []
            });
            setGlobalOptionRecipeItems([]);
        }
        setShowGlobalOptionModal(true);
    };

    const handleGlobalOptionSubmit = async (e) => {
        e.preventDefault();
        try {
            let optionId;
            if (editingGlobalOption) {
                await api.updateGlobalOption(editingGlobalOption.id, globalOptionForm);
                optionId = editingGlobalOption.id;
            } else {
                const res = await api.addGlobalOption(globalOptionForm);
                optionId = res.id;
            }

            // Save recipe items
            await api.saveGlobalOptionRecipe(optionId, globalOptionRecipeItems);

            setShowGlobalOptionModal(false);
            loadData();
        } catch (error) {
            console.error("Error saving global option:", error);
        }
    };

    const handleDeleteGlobalOption = async (id) => {
        if (!confirm('ต้องการลบ Option นี้หรือไม่?')) return;
        try {
            await api.deleteGlobalOption(id);
            loadData();
        } catch (error) {
            console.error("Error deleting global option:", error);
        }
    };

    const toggleCategorySelection = (categoryId) => {
        setGlobalOptionForm(prev => {
            const exists = prev.category_ids.includes(categoryId);
            return {
                ...prev,
                category_ids: exists
                    ? prev.category_ids.filter(id => id !== categoryId)
                    : [...prev.category_ids, categoryId]
            };
        });
    };

    const openProductModal = async (product = null) => {
        setEditingProduct(product);
        setActiveModalTab('info');
        if (product) {
            setProductForm({ ...product });
            // Fetch recipe and options if editing
            try {
                const [recipe, options] = await Promise.all([
                    api.getProductRecipe(product.id),
                    api.getProductOptions(product.id)
                ]);
                setRecipeItems(Array.isArray(recipe) ? recipe : []);
                setProductOptions(Array.isArray(options) ? options : []);
            } catch (e) {
                console.error("Error loading recipe/options:", e);
                setRecipeItems([]);
                setProductOptions([]);
            }
        } else {
            setProductForm({
                name: '',
                price: 0,
                category_id: categories[0]?.id || '',
                image: '',
                is_available: true,
                track_stock: 0,
                stock_quantity: 0,
                is_recommended: false
            });
            setRecipeItems([]);
            setProductOptions([]);
        }
        setOptionForm({ name: '', price_modifier: 0, is_size_option: false, stock_quantity: 0 });
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

    const handleSaveOptionRecipe = async () => {
        if (!editingOptionRecipe) return;
        try {
            await api.saveOptionRecipe(editingOptionRecipe.id, optionRecipeItems);
            setShowOptionRecipeModal(false);
            setEditingOptionRecipe(null);
            alert("✅ บันทึกสูตรสำหรับ Option เรียบร้อยแล้ว");
        } catch (error) {
            console.error("Error saving option recipe:", error);
            alert("❌ เกิดข้อผิดพลาดในการบันทึกสูตร");
        }
    };

    const updateOptionRecipeItem = (ingredientId, quantity, unit) => {
        setOptionRecipeItems(prev => prev.map(item => {
            if (item.ingredient_id === ingredientId) {
                let finalQty = quantity;
                // If the display unit is a sub-unit, convert to base unit
                if (item.unit === 'kg' && unit === 'g') finalQty = quantity / 1000;
                else if (item.unit === 'l' && unit === 'ml') finalQty = quantity / 1000;

                return { ...item, quantity_used: finalQty, displayUnit: unit };
            }
            return item;
        }));
    };

    const toggleOptionRecipeUnit = (ingredientId) => {
        setOptionRecipeItems(prev => prev.map(item => {
            if (item.ingredient_id === ingredientId) {
                const currentUnit = item.displayUnit || item.unit;
                let nextUnit = currentUnit;
                let nextQty = item.quantity_used;

                if (item.unit === 'kg') {
                    nextUnit = currentUnit === 'kg' ? 'g' : 'kg';
                    nextQty = nextUnit === 'g' ? item.quantity_used * 1000 : item.quantity_used;
                } else if (item.unit === 'l') {
                    nextUnit = currentUnit === 'l' ? 'ml' : 'l';
                    nextQty = nextUnit === 'ml' ? item.quantity_used * 1000 : item.quantity_used;
                }

                return { ...item, displayUnit: nextUnit };
            }
            return item;
        }));
    };

    const addIngredientToOptionRecipe = (ingredient) => {
        if (optionRecipeItems.find(i => i.ingredient_id === ingredient.id)) return;
        setOptionRecipeItems([...optionRecipeItems, {
            ingredient_id: ingredient.id,
            ingredient_name: ingredient.name,
            quantity_used: 1,
            unit: ingredient.unit,
            displayUnit: ingredient.unit // Default to base unit
        }]);
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
                        <button
                            onClick={() => setActiveTab('global-options')}
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-[22px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === 'global-options'
                                ? 'bg-white text-purple-600 shadow-md ring-1 ring-purple-500/10'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                }`}
                        >
                            🎛️ <span className="hidden sm:inline">Global</span> Options
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Sync Status Toast */}
                        {syncStatus.message && (
                            <div className={`px-4 py-2 rounded-2xl text-[11px] font-bold ${syncStatus.error ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'} animate-fade-in`}>
                                {syncStatus.message}
                            </div>
                        )}

                        {/* Sync to Website Button */}
                        {isOwner && (
                            <button
                                onClick={handleSyncToWebsite}
                                disabled={syncStatus.loading}
                                className="group relative px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] overflow-hidden transition-all hover:scale-[1.05] hover:shadow-2xl active:scale-95 shadow-xl"
                                title="Sync เมนูไปยังเว็บไซต์ร้านอาหาร"
                            >
                                <span className="relative flex items-center gap-2">
                                    {syncStatus.loading ? (
                                        <>
                                            <span className="animate-spin">⏳</span>
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            🌐 Sync Website
                                        </>
                                    )}
                                </span>
                            </button>
                        )}

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
                                                                {/* Show computed status with reason */}
                                                                {p.computed_available === false && p.is_available ? (
                                                                    <span className="text-[9px] font-black uppercase tracking-tighter text-red-500">
                                                                        {!p.has_recipe ? '⚠️ No Recipe' : !p.can_make ? '⚠️ Low Stock' : 'Sold Out'}
                                                                    </span>
                                                                ) : (
                                                                    <span className={`text-[9px] font-black uppercase tracking-tighter ${p.is_available ? 'text-orange-600' : 'text-slate-400'}`}>
                                                                        {p.is_available ? 'Available' : 'Sold Out'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <div className={`text-xl font-black tabular-nums tracking-tighter ${p.computed_available !== false ? 'text-orange-600' : 'text-slate-300'}`}>
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
                    ) : activeTab === 'categories' ? (
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
                    ) : activeTab === 'global-options' ? (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between px-2">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Global <span className="text-purple-600">Options</span></h2>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Options ที่ Apply กับหมวดหมู่ทั้งหมด • รวม {globalOptions.length} รายการ</p>
                                </div>
                                {isOwner && (
                                    <button
                                        onClick={() => openGlobalOptionModal()}
                                        className="group relative px-8 py-4 bg-purple-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] overflow-hidden transition-all hover:scale-[1.05] hover:shadow-2xl active:scale-95 shadow-xl"
                                    >
                                        <span className="relative flex items-center gap-3">
                                            <span className="text-lg">+</span>
                                            สร้าง Option ใหม่
                                        </span>
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {globalOptions.map(opt => (
                                    <div key={opt.id} className="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-500 relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-50 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-black text-lg text-slate-900 tracking-tight">{opt.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-purple-600 font-black text-lg">+฿{Number(opt.price_modifier).toLocaleString()}</span>
                                                        {opt.is_size_option && (
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-black uppercase rounded-full">Size Option</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isOwner && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => openGlobalOptionModal(opt)}
                                                            className="w-8 h-8 bg-slate-50 hover:bg-purple-50 text-slate-400 hover:text-purple-500 rounded-xl transition-all flex items-center justify-center text-sm"
                                                        >✏️</button>
                                                        <button
                                                            onClick={() => handleDeleteGlobalOption(opt.id)}
                                                            className="w-8 h-8 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all flex items-center justify-center text-sm"
                                                        >🗑️</button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Applied Categories */}
                                            <div className="mt-4 pt-4 border-t border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Apply กับหมวดหมู่:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {opt.category_ids && opt.category_ids.length > 0 ? (
                                                        opt.category_ids.map(catId => {
                                                            const cat = categories.find(c => c.id === catId);
                                                            return cat ? (
                                                                <span key={catId} className="px-3 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded-full border border-purple-200">
                                                                    {cat.icon} {cat.name}
                                                                </span>
                                                            ) : null;
                                                        })
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic">ยังไม่ได้กำหนดหมวดหมู่</span>
                                                    )}
                                                </div>
                                            </div>

                                            {opt.recipe_multiplier && opt.recipe_multiplier !== 1 && (
                                                <div className="mt-3 text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg inline-block">
                                                    ⚡ Recipe x{opt.recipe_multiplier}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {globalOptions.length === 0 && (
                                    <div className="col-span-full py-20 text-center">
                                        <span className="text-6xl block mb-4 grayscale opacity-20">🎛️</span>
                                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300">ยังไม่มี Global Options</p>
                                        <p className="text-sm text-slate-400 mt-2">กดปุ่ม "สร้าง Option ใหม่" เพื่อเริ่มต้น</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
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
                                        Recipe
                                    </button>
                                    <button
                                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeModalTab === 'options' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
                                        onClick={() => setActiveModalTab('options')}
                                    >
                                        Options
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

                                        {/* Recommended Toggle */}
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 border-l-4 border-l-pink-500 flex items-center justify-between">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Recommended Menu</label>
                                                <p className="text-[10px] text-slate-400">แสดงเมนูนี้ในหมวด "เมนูแนะนำ" หรือไม่</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={productForm.is_recommended}
                                                    onChange={e => setProductForm({ ...productForm, is_recommended: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                                            </label>
                                        </div>
                                    </form>
                                ) : activeModalTab === 'recipe' ? (
                                    <div className="space-y-8 animate-fade-in">
                                        <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 text-orange-800 text-[11px] font-bold">
                                            <span className="text-lg">ℹ️</span> Define ingredient ratios for automated stock depletion upon transaction.
                                        </div>

                                        {/* Precision Entry */}
                                        <div className="p-6 bg-slate-900 rounded-[24px] text-white shadow-xl relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent"></div>
                                            <div className="relative z-10 space-y-4">
                                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Add Ingredient</label>
                                                {/* Ingredient Selector */}
                                                <select
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:ring-2 ring-orange-500/50 appearance-none"
                                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23999\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'m6 8 4 4 4-4\'/%3E%3C/svg%3E")', backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', backgroundSize: '20px' }}
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
                                                    <option value="">-- Select Ingredient --</option>
                                                    {allIngredients.map(ing => (
                                                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.total_quantity} {ing.unit})</option>
                                                    ))}
                                                </select>
                                                {/* Quantity + Unit Row */}
                                                <div className="flex gap-3">
                                                    <input type="number" step="any" className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:ring-2 ring-orange-500/50" id="ing-qty" placeholder="Quantity..." />
                                                    <select id="unit-select" className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-white outline-none focus:ring-2 ring-orange-500/50">
                                                        <option value="units">-</option>
                                                    </select>
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
                                                    className="w-full py-3 mt-2 bg-orange-600 hover:bg-orange-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                                                >
                                                    + Add Ingredient
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
                                ) : activeModalTab === 'options' ? (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-[11px] font-bold">
                                            <span className="text-lg">💎</span> Add-ons หรือ Size Options
                                        </div>

                                        {/* Add Option Form */}
                                        <div className="p-6 bg-slate-900 rounded-[24px] text-white shadow-xl">
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Add New Option</label>
                                            <div className="space-y-4">
                                                <div className="flex gap-3">
                                                    <input type="text" placeholder="ชื่อ Option" className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none" value={optionForm.name} onChange={e => setOptionForm({ ...optionForm, name: e.target.value })} />
                                                    <input type="number" placeholder="+฿" className="w-24 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none" value={optionForm.price_modifier} onChange={e => setOptionForm({ ...optionForm, price_modifier: Number(e.target.value) })} />
                                                </div>
                                                <div className="flex gap-4 items-center flex-wrap">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={optionForm.is_size_option} onChange={e => setOptionForm({ ...optionForm, is_size_option: e.target.checked })} className="w-4 h-4 rounded accent-orange-500" />
                                                        <span className="text-sm text-slate-300">Size Option (มี Stock)</span>
                                                    </label>
                                                    {optionForm.is_size_option && (
                                                        <input type="number" placeholder="Stock" className="w-24 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" value={optionForm.stock_quantity} onChange={e => setOptionForm({ ...optionForm, stock_quantity: Number(e.target.value) })} />
                                                    )}
                                                    <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipe x</span>
                                                        <input
                                                            type="number" step="0.01" placeholder="1.00"
                                                            className="w-16 bg-transparent text-sm text-white outline-none"
                                                            value={optionForm.recipe_multiplier}
                                                            onChange={e => setOptionForm({ ...optionForm, recipe_multiplier: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <p className="text-[9px] text-slate-500 italic w-full">* ใช้สำหรับสั่ง 'พิเศษ' เพื่อเพิ่มปริมาณวัตถุดิบในสูตร (เช่น 1.03 = +3%)</p>
                                                </div>
                                                <button onClick={async () => { if (!optionForm.name || !editingProduct) return; try { await api.addProductOption(editingProduct.id, optionForm); const options = await api.getProductOptions(editingProduct.id); setProductOptions(options || []); setOptionForm({ name: '', price_modifier: 0, is_size_option: false, stock_quantity: 0, recipe_multiplier: 1.00 }); } catch (e) { console.error(e); } }} disabled={!optionForm.name} className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 text-[10px] font-black uppercase rounded-xl">+ Add Option</button>
                                            </div>
                                        </div>

                                        {/* Options List */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Current Options</h4>
                                            <div className="bg-slate-50 border border-slate-100 rounded-[24px] overflow-hidden">
                                                {productOptions.length > 0 ? productOptions.map(opt => (
                                                    <div key={opt.id} className="flex items-center justify-between p-5 border-b border-slate-100 last:border-0 hover:bg-white">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${opt.is_size_option ? 'bg-blue-100' : 'bg-orange-100'}`}>{opt.is_size_option ? '📏' : '➕'}</div>
                                                            <div>
                                                                <span className="font-bold text-slate-800">{opt.name}</span>
                                                                {opt.is_size_option && <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${opt.stock_quantity > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>Stock: {opt.stock_quantity}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-orange-600 font-bold">+฿{opt.price_modifier}</span>
                                                            <button
                                                                onClick={async () => {
                                                                    setEditingOptionRecipe(opt);
                                                                    try {
                                                                        const recipe = await api.getOptionRecipe(opt.id);
                                                                        setOptionRecipeItems(Array.isArray(recipe) ? recipe : []);
                                                                    } catch (e) {
                                                                        setOptionRecipeItems([]);
                                                                    }
                                                                    setShowOptionRecipeModal(true);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                                                title="Set Recipe"
                                                            >📋</button>
                                                            <button onClick={async () => { if (window.confirm('ลบ Option นี้?')) { await api.deleteProductOption(opt.id); const options = await api.getProductOptions(editingProduct.id); setProductOptions(options || []); } }} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500">✕</button>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="py-16 text-center text-slate-300">
                                                        <span className="text-4xl block mb-4 grayscale opacity-20">💎</span>
                                                        <p className="text-[10px] font-black uppercase">No Options Yet</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="px-10 py-8 bg-[#f8fafc] border-t border-slate-100 flex gap-4">
                                <button type="button" onClick={() => setShowProductModal(false)} className="px-8 py-5 bg-white border border-slate-200 text-slate-900 rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex-1 shadow-sm">
                                    Abort
                                </button>
                                <button
                                    onClick={() => {
                                        if (activeModalTab === 'info') {
                                            document.getElementById('product-form')?.requestSubmit();
                                        } else if (activeModalTab === 'recipe') {
                                            handleSaveRecipe();
                                        } else {
                                            // Options are saved immediately, just close
                                            setShowProductModal(false);
                                        }
                                    }}
                                    className="px-8 py-5 bg-slate-900 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex-1 shadow-xl relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    {activeModalTab === 'info' ? 'Save Product' : activeModalTab === 'recipe' ? 'Save Recipe' : 'Done'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
                }

                {/* Option Recipe Modal */}
                {showOptionRecipeModal && editingOptionRecipe && (
                    <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowOptionRecipeModal(false)}>
                        <div className="bg-white rounded-[48px] w-full max-w-xl shadow-2xl animate-fade-in-up relative border border-white overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="h-2 bg-gradient-to-r from-blue-400 to-indigo-600"></div>

                            <div className="px-8 py-8 border-b border-slate-100 bg-[#f8fafc]">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Configure <span className="text-blue-600">Option Recipe</span></h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Option: {editingOptionRecipe.name}</p>
                                    </div>
                                    <button onClick={() => setShowOptionRecipeModal(false)} className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-300 hover:text-slate-600 flex items-center justify-center transition-all">✕</button>
                                </div>
                            </div>

                            <div className="p-8 overflow-y-auto space-y-6 custom-scrollbar flex-1">
                                {/* Ingredient Search & Selection */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Components Required</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {allIngredients.slice(0, 10).map(ing => (
                                            <button
                                                key={ing.id}
                                                onClick={() => addIngredientToOptionRecipe(ing)}
                                                className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                                            >
                                                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs group-hover:scale-110 transition-transform">📦</div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-700 truncate">{ing.name}</p>
                                                    <p className="text-[9px] text-slate-400 uppercase font-black">{ing.unit}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Active Recipe Table */}
                                <div className="space-y-4">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Recipe Configuration</label>
                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl overflow-hidden shadow-inner">
                                        {optionRecipeItems.length > 0 ? optionRecipeItems.map(item => {
                                            const displayUnit = item.displayUnit || item.unit;
                                            let displayQty = item.quantity_used;
                                            if (item.unit === 'kg' && displayUnit === 'g') displayQty = item.quantity_used * 1000;
                                            else if (item.unit === 'l' && displayUnit === 'ml') displayQty = item.quantity_used * 1000;

                                            return (
                                                <div key={item.ingredient_id} className="flex items-center justify-between p-5 border-b border-slate-100 last:border-0 bg-white/50 hover:bg-white transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-lg">🥣</span>
                                                        <div>
                                                            <p className="text-[12px] font-black text-slate-800">{item.ingredient_name}</p>
                                                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{item.unit}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                                            <input
                                                                type="number" step="0.001"
                                                                className="w-16 bg-transparent text-center text-xs font-black text-slate-900 outline-none"
                                                                value={displayQty}
                                                                onChange={e => updateOptionRecipeItem(item.ingredient_id, parseFloat(e.target.value), displayUnit)}
                                                            />
                                                            <button
                                                                onClick={() => toggleOptionRecipeUnit(item.ingredient_id)}
                                                                className={`text-[9px] font-black px-2 py-1 rounded-lg transition-all ${['kg', 'l'].includes(item.unit) ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'text-slate-400'}`}
                                                                disabled={!['kg', 'l'].includes(item.unit)}
                                                            >
                                                                {displayUnit}
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={() => setOptionRecipeItems(optionRecipeItems.filter(i => i.ingredient_id !== item.ingredient_id))}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >✕</button>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="py-12 text-center">
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Recipe Matrix Empty</p>
                                                <p className="text-[9px] text-slate-300 mt-1">Add components to track stock consumption</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="px-8 py-8 bg-[#f8fafc] border-t border-slate-100 flex gap-4">
                                <button type="button" onClick={() => setShowOptionRecipeModal(false)} className="flex-1 px-8 py-4 bg-white border border-slate-200 text-slate-900 rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">Discard</button>
                                <button onClick={handleSaveOptionRecipe} className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">Authorize Recipe</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Category Modal */}
                {
                    showCategoryModal && (
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
                    )
                }

                {/* Global Option Modal */}
                {showGlobalOptionModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowGlobalOptionModal(false)}>
                        <div className="bg-white rounded-[48px] w-full max-w-lg shadow-2xl animate-fade-in-up relative border border-white overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="h-2 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                            <div className="px-10 py-10">
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-8">
                                    {editingGlobalOption ? 'แก้ไข' : 'สร้าง'} <span className="text-purple-600">Global Option</span>
                                </h3>
                                <form onSubmit={handleGlobalOptionSubmit} className="space-y-6">
                                    {/* Name */}
                                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ชื่อ Option</label>
                                        <input
                                            type="text" required placeholder="เช่น พิเศษ, ไข่ดาว..."
                                            className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none placeholder:text-slate-300"
                                            value={globalOptionForm.name}
                                            onChange={e => setGlobalOptionForm({ ...globalOptionForm, name: e.target.value })}
                                        />
                                    </div>

                                    {/* Price + Recipe Multiplier */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">เพิ่มราคา (฿)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none"
                                                value={globalOptionForm.price_modifier}
                                                onChange={e => setGlobalOptionForm({ ...globalOptionForm, price_modifier: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Recipe x</label>
                                            <input
                                                type="number" step="0.01"
                                                className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none"
                                                value={globalOptionForm.recipe_multiplier}
                                                onChange={e => setGlobalOptionForm({ ...globalOptionForm, recipe_multiplier: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    {/* Size Option Toggle */}
                                    <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <input
                                            type="checkbox"
                                            id="is-size-option"
                                            checked={globalOptionForm.is_size_option}
                                            onChange={e => setGlobalOptionForm({ ...globalOptionForm, is_size_option: e.target.checked })}
                                            className="w-5 h-5 rounded accent-blue-500"
                                        />
                                        <label htmlFor="is-size-option" className="text-sm font-bold text-blue-700 cursor-pointer">
                                            Size Option (มี Stock แยก)
                                        </label>
                                    </div>

                                    {globalOptionForm.is_size_option && (
                                        <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">จำนวน Stock</label>
                                            <input
                                                type="number"
                                                className="w-full bg-transparent text-lg font-bold text-slate-900 outline-none"
                                                value={globalOptionForm.stock_quantity}
                                                onChange={e => setGlobalOptionForm({ ...globalOptionForm, stock_quantity: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}

                                    {/* Category Selection */}
                                    <div className="p-5 bg-purple-50 rounded-3xl border border-purple-100">
                                        <label className="block text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">Apply กับหมวดหมู่:</label>
                                        <div className="flex flex-wrap gap-3">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => toggleCategorySelection(cat.id)}
                                                    className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${globalOptionForm.category_ids.includes(cat.id)
                                                        ? 'bg-purple-600 text-white shadow-lg'
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
                                                        }`}
                                                >
                                                    {cat.icon} {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                        {globalOptionForm.category_ids.length === 0 && (
                                            <p className="text-[10px] text-amber-600 mt-2 font-bold">⚠️ กรุณาเลือกอย่างน้อย 1 หมวดหมู่</p>
                                        )}
                                    </div>

                                    {/* Recipe Configuration */}
                                    <div className="p-5 bg-orange-50 rounded-3xl border border-orange-100">
                                        <label className="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3">สูตรการตัดสต็อก (Ingredients)</label>

                                        <div className="space-y-3 mb-4">
                                            {globalOptionRecipeItems.map((item, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <select
                                                        className="flex-1 px-3 py-2 bg-white rounded-xl text-sm font-bold border border-orange-200 outline-none"
                                                        value={item.ingredient_id}
                                                        onChange={e => {
                                                            const ing = allIngredients.find(i => i.id === parseInt(e.target.value));
                                                            const newItems = [...globalOptionRecipeItems];
                                                            newItems[idx] = {
                                                                ...newItems[idx],
                                                                ingredient_id: parseInt(e.target.value),
                                                                unit: ing ? ing.unit : ''
                                                            };
                                                            setGlobalOptionRecipeItems(newItems);
                                                        }}
                                                    >
                                                        <option value="">เลือกวัตถุดิบ...</option>
                                                        {allIngredients.map(ing => (
                                                            <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="Qty"
                                                        className="w-20 px-3 py-2 bg-white rounded-xl text-sm font-bold border border-orange-200 outline-none"
                                                        value={item.quantity_used}
                                                        onChange={e => {
                                                            const newItems = [...globalOptionRecipeItems];
                                                            newItems[idx] = { ...newItems[idx], quantity_used: parseFloat(e.target.value) };
                                                            setGlobalOptionRecipeItems(newItems);
                                                        }}
                                                    />
                                                    <span className="text-xs font-bold text-orange-400 w-8">{item.unit}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newItems = globalOptionRecipeItems.filter((_, i) => i !== idx);
                                                            setGlobalOptionRecipeItems(newItems);
                                                        }}
                                                        className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-500 rounded-xl hover:bg-red-200"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setGlobalOptionRecipeItems([...globalOptionRecipeItems, { ingredient_id: '', quantity_used: 1, unit: '' }])}
                                            className="w-full py-2 bg-orange-100 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-200 transition-colors"
                                        >
                                            + เพิ่มวัตถุดิบ
                                        </button>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setShowGlobalOptionModal(false)} className="flex-1 px-4 py-4 bg-white border border-slate-200 text-slate-900 rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-sm">ยกเลิก</button>
                                        <button
                                            type="submit"
                                            disabled={globalOptionForm.category_ids.length === 0}
                                            className="flex-1 px-4 py-4 bg-purple-600 disabled:bg-slate-300 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.05] transition-all"
                                        >
                                            บันทึก
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div >
        </MasterLayout >
    );
};

export default MenuManagement;
