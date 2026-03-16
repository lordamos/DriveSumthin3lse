'use client';

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { SystemAuditService } from '@/lib/audit';
import { OwnershipService } from '@/lib/ownership';
import { AuditDashboard } from '@/components/AuditDashboard';
import { handleFirestoreError, OperationType } from '@/lib/error-handler';
import { Shield, Car, FileText, CheckCircle, AlertTriangle, LogIn, LogOut, Activity, ImageIcon, Plus, Users, Calendar, CreditCard, X, Award, BarChart3, Loader2, Sparkles, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { GoogleGenAI } from "@google/genai";
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function DriveHomeContent() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  
  // Contract Form State
  const [showContractForm, setShowContractForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [contractPrice, setContractPrice] = useState<number>(0);
  const [paymentFrequency, setPaymentFrequency] = useState<string>('WEEKLY');
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  // Vehicle Form State
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState<number>(new Date().getFullYear());
  const [vehiclePrice, setVehiclePrice] = useState<number>(0);
  const [vehicleImageUrl, setVehicleImageUrl] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [adminTab, setAdminTab] = useState<'FLEET' | 'AUDIT'>('FLEET');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || paymentAmount <= 0 || !user) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedContract.id,
          amount: paymentAmount,
          userId: user.uid,
          userEmail: user.email,
          vehicleName: `${selectedContract.vehicleDetails?.year} ${selectedContract.vehicleDetails?.make} ${selectedContract.vehicleDetails?.model}`
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      // Notify admin of failed payment attempt
      if (selectedContract && user) {
        OwnershipService.notifyAdmin('PAYMENT_FAILED', {
          contractId: selectedContract.id,
          userId: user.uid,
          userEmail: user.email || 'Unknown',
          message: `Stripe Checkout initiation failed for contract ${selectedContract.id}. Error: ${error.message || 'Unknown error'}`
        });
      }
      console.error('Payment failed:', error);
      alert('Failed to start payment process. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVehicleImage = (vehicle: any) => {
    if (vehicle.imageUrl) return vehicle.imageUrl;
    const seed = `${vehicle.make}-${vehicle.model}-${vehicle.year}`.toLowerCase().replace(/\s+/g, '-');
    return `https://picsum.photos/seed/${seed}/800/600`;
  };

  useEffect(() => {
    if (!mounted) return;
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success) {
      alert('Payment successful! Your contract will be updated shortly.');
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }
    if (canceled) {
      alert('Payment was canceled.');
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams, mounted]);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Check admin status
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        setIsAdmin(userData?.role === 'admin' || user.email === 'haylenik@gmail.com');
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !mounted) return;
    const q = query(collection(db, 'vehicles'), orderBy('make'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vehicleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vehicleList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vehicles');
    });
    return () => unsubscribe();
  }, [user, mounted]);

  useEffect(() => {
    if (!user || !mounted) return;
    const q = query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contractList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setContracts(isAdmin ? contractList : contractList.filter(c => c.userId === user.uid));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contracts');
    });
    return () => unsubscribe();
  }, [user, mounted, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !mounted) return;
    const q = query(collection(db, 'users'), orderBy('email'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setAllUsers(userList.filter(u => u.role === 'client'));
    });
    return () => unsubscribe();
  }, [isAdmin, mounted]);

  useEffect(() => {
    if (!user || !mounted) return;
    const q = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setPayments(isAdmin ? paymentList : paymentList.filter(p => p.userId === user.uid));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'payments');
    });
    return () => unsubscribe();
  }, [user, mounted, isAdmin]);

  useEffect(() => {
    if (!user || !mounted) return;
    const q = query(collection(db, 'certificates'), orderBy('issuedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const certList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setCertificates(isAdmin ? certList : certList.filter(c => c.userId === user.uid));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'certificates');
    });
    return () => unsubscribe();
  }, [user, mounted, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !mounted) return;
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setNotifications(notificationList);
    });
    return () => unsubscribe();
  }, [isAdmin, mounted]);

  if (!mounted) return null;

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        // Use setDoc instead of updateDoc for new users
        const { setDoc } = await import('firebase/firestore');
        await setDoc(userRef, {
          email: result.user.email,
          displayName: result.user.displayName,
          role: result.user.email === 'haylenik@gmail.com' ? 'admin' : 'client',
          uid: result.user.uid
        });
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('Login popup closed by user');
        return;
      }
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
    }
  };

  const handleLogout = () => signOut(auth);

  const markAsDelinquent = async (contract: any) => {
    if (!confirm(`Are you sure you want to mark contract ${contract.id} as DELINQUENT?`)) return;
    await OwnershipService.markAsDelinquent(contract.id, contract.userId, contract.userEmail || 'Unknown', 'Manual admin intervention');
    alert('Contract marked as delinquent.');
  };

  const deleteNotification = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const generateVehicleImage = async () => {
    if (!vehicleMake || !vehicleModel) {
      alert('Please enter make and model first.');
      return;
    }
    
    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const prompt = `A professional studio photograph of a ${vehicleYear} ${vehicleMake} ${vehicleModel}. High quality, clean background, automotive photography style.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setVehicleImageUrl(imageUrl);
          return;
        }
      }
      throw new Error('No image generated');
    } catch (error) {
      console.error('Image generation failed:', error);
      // Fallback to picsum if Gemini fails
      const seed = `${vehicleMake}-${vehicleModel}-${vehicleYear}`.toLowerCase().replace(/\s+/g, '-');
      setVehicleImageUrl(`https://picsum.photos/seed/${seed}/800/600`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const createVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleMake || !vehicleModel || vehicleYear <= 1900 || vehiclePrice <= 0) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'vehicles'), {
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYear,
        price: vehiclePrice,
        status: 'AVAILABLE',
        imageUrl: vehicleImageUrl || null,
        createdAt: serverTimestamp()
      });

      setShowVehicleForm(false);
      setVehicleMake('');
      setVehicleModel('');
      setVehicleYear(new Date().getFullYear());
      setVehiclePrice(0);
      setVehicleImageUrl('');
      alert('Vehicle added to inventory!');
    } catch (error) {
      console.error('Vehicle creation failed:', error);
      alert('Failed to add vehicle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !selectedClient || contractPrice <= 0 || installmentAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      
      await addDoc(collection(db, 'contracts'), {
        vehicleId: selectedVehicle,
        userId: selectedClient,
        totalPaid: 0,
        totalBalance: contractPrice,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        paymentSchedule: {
          frequency: paymentFrequency,
          installmentAmount: installmentAmount,
          startDate: startDate,
          nextPaymentDate: startDate // Initial next payment is the start date
        },
        vehicleDetails: {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year
        }
      });

      await updateDoc(doc(db, 'vehicles', selectedVehicle), {
        status: 'RENTED'
      });

      setShowContractForm(false);
      setSelectedVehicle('');
      setSelectedClient('');
      setContractPrice(0);
      setInstallmentAmount(0);
      setPaymentFrequency('WEEKLY');
      alert('Contract created successfully!');
    } catch (error) {
      console.error('Contract creation failed:', error);
      alert('Failed to create contract.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const result = await SystemAuditService.runFullAudit(user?.email || 'admin');
      if (result.errors.length === 0) {
        setAuditLogs(['[SUCCESS] All systems green. No drift detected. Integrity Score: ' + result.integrityScore + '%']);
      } else {
        setAuditLogs(result.errors);
      }
    } catch (error) {
      setAuditLogs(['[ERROR] Audit failed to execute. Check logs.']);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Car className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DRIVE HOME</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-bold">Rent-to-Own Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && isAdmin && (
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white relative"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-black"></span>
                  )}
                </button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                    >
                      <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Notifications</h4>
                        <button onClick={() => setShowNotifications(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-zinc-600 text-xs">No notifications</div>
                        ) : (
                          notifications.map(n => (
                            <div key={n.id} className={`p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${n.read ? 'opacity-50' : ''}`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${n.type === 'PAYMENT_FAILED' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {n.type.replace('_', ' ')}
                                </span>
                                <button onClick={() => deleteNotification(n.id)} className="text-zinc-600 hover:text-white"><CheckCircle size={12} /></button>
                              </div>
                              <p className="text-xs text-zinc-300 mb-2">{n.message}</p>
                              <p className="text-[8px] text-zinc-600 font-mono">{n.timestamp?.toDate().toLocaleString()}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-[10px] text-zinc-500">{isAdmin ? 'ADMINISTRATOR' : 'CLIENT'}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-bold hover:bg-zinc-200 transition-all active:scale-95"
              >
                <LogIn size={18} />
                <span>Connect</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {!user ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl"
            >
              <h2 className="text-5xl font-bold mb-6 leading-tight">Secure your path to <span className="text-emerald-500">ownership.</span></h2>
              <p className="text-zinc-400 text-lg mb-10">Connect your account to access the vehicle inventory and track your progress toward ownership with 777-grade integrity.</p>
              <button 
                onClick={handleLogin}
                className="bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                GET STARTED
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-12">
              {isAdmin && (
                <section className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <h3 className="text-xl font-bold flex items-center gap-3">
                        <Shield className="text-emerald-500" />
                        Admin Command
                      </h3>
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button 
                          onClick={() => setAdminTab('FLEET')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminTab === 'FLEET' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                        >
                          FLEET
                        </button>
                        <button 
                          onClick={() => setAdminTab('AUDIT')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${adminTab === 'AUDIT' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                        >
                          AUDIT
                        </button>
                      </div>
                    </div>
                    {adminTab === 'FLEET' && (
                      <div className="flex gap-3">
                        <button 
                          onClick={() => {
                            setShowVehicleForm(!showVehicleForm);
                            setShowContractForm(false);
                          }}
                          className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-xl font-bold hover:bg-white/20 transition-all border border-white/10"
                        >
                          <Car size={18} />
                          <span>Add Vehicle</span>
                        </button>
                        <button 
                          onClick={() => {
                            setShowContractForm(!showContractForm);
                            setShowVehicleForm(false);
                          }}
                          className="flex items-center gap-2 bg-emerald-500 text-black px-4 py-2 rounded-xl font-bold hover:bg-emerald-400 transition-all"
                        >
                          <Plus size={18} />
                          <span>New Contract</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {adminTab === 'AUDIT' ? (
                    <AuditDashboard />
                  ) : (
                    <>
                      <AnimatePresence>
                        {showVehicleForm && (
                          <motion.form 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            onSubmit={createVehicle}
                            className="space-y-6 overflow-hidden border-t border-white/10 pt-6"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Make</label>
                                <input 
                                  type="text"
                                  required
                                  placeholder="e.g. Toyota"
                                  value={vehicleMake}
                                  onChange={(e) => setVehicleMake(e.target.value)}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model</label>
                                <input 
                                  type="text"
                                  required
                                  placeholder="e.g. Camry"
                                  value={vehicleModel}
                                  onChange={(e) => setVehicleModel(e.target.value)}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Year</label>
                                <input 
                                  type="number"
                                  required
                                  value={vehicleYear}
                                  onChange={(e) => setVehicleYear(Number(e.target.value))}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Price ($)</label>
                                <input 
                                  type="number"
                                  required
                                  value={vehiclePrice}
                                  onChange={(e) => setVehiclePrice(Number(e.target.value))}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Image URL (Optional)</label>
                                <div className="flex gap-4">
                                  <input 
                                    type="url"
                                    placeholder="https://example.com/car.jpg"
                                    value={vehicleImageUrl}
                                    onChange={(e) => setVehicleImageUrl(e.target.value)}
                                    className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                  />
                                  <button 
                                    type="button"
                                    disabled={isGeneratingImage}
                                    onClick={generateVehicleImage}
                                    className="px-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-bold disabled:opacity-50"
                                  >
                                    {isGeneratingImage ? (
                                      <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={16} className="text-emerald-500" />
                                    )}
                                    <span>{isGeneratingImage ? 'Generating...' : 'AI Generate'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-4">
                              <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-emerald-500 text-black py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                              >
                                {isSubmitting ? 'ADDING...' : 'ADD TO INVENTORY'}
                              </button>
                              <button 
                                type="button"
                                onClick={() => setShowVehicleForm(false)}
                                className="px-6 py-3 border border-white/10 rounded-xl font-bold hover:bg-white/5 transition-all"
                              >
                                CANCEL
                              </button>
                            </div>
                          </motion.form>
                        )}
                      </AnimatePresence>

                      <AnimatePresence>
                        {showContractForm && (
                          <motion.form 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            onSubmit={createContract}
                            className="space-y-6 overflow-hidden border-t border-white/10 pt-6"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Vehicle</label>
                                <select 
                                  required
                                  value={selectedVehicle}
                                  onChange={(e) => {
                                    setSelectedVehicle(e.target.value);
                                    const v = vehicles.find(veh => veh.id === e.target.value);
                                    if (v) setContractPrice(v.price);
                                  }}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                >
                                  <option value="">Choose a vehicle...</option>
                                  {vehicles.filter(v => v.status === 'AVAILABLE').map(v => (
                                    <option key={v.id} value={v.id}>{v.make} {v.model} ({v.year})</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Select Client</label>
                                <select 
                                  required
                                  value={selectedClient}
                                  onChange={(e) => setSelectedClient(e.target.value)}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                >
                                  <option value="">Choose a client...</option>
                                  {allUsers.map(u => (
                                    <option key={u.id} value={u.id}>{u.displayName || u.email}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Contract Price ($)</label>
                                <input 
                                  type="number"
                                  required
                                  value={contractPrice}
                                  onChange={(e) => setContractPrice(Number(e.target.value))}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Payment Frequency</label>
                                <div className="grid grid-cols-3 gap-2">
                                  {['WEEKLY', 'BIWEEKLY', 'MONTHLY'].map((freq) => (
                                    <button
                                      key={freq}
                                      type="button"
                                      onClick={() => setPaymentFrequency(freq)}
                                      className={`py-3 rounded-xl text-[10px] font-bold transition-all border ${
                                        paymentFrequency === freq 
                                          ? 'bg-emerald-500 text-black border-emerald-500' 
                                          : 'bg-black text-zinc-400 border-white/10 hover:border-white/20'
                                      }`}
                                    >
                                      {freq === 'BIWEEKLY' ? 'BI-WEEKLY' : freq}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Installment Amount ($)</label>
                                <input 
                                  type="number"
                                  required
                                  value={installmentAmount}
                                  onChange={(e) => setInstallmentAmount(Number(e.target.value))}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Start Date</label>
                                <div className="relative">
                                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
                                  <input 
                                    type="date"
                                    required
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-black border border-white/10 rounded-xl pl-12 pr-4 py-3 focus:border-emerald-500 outline-none transition-all [color-scheme:dark]"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-4">
                              <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-emerald-500 text-black py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all disabled:opacity-50"
                              >
                                {isSubmitting ? 'CREATING...' : 'INITIALIZE CONTRACT'}
                              </button>
                              <button 
                                type="button"
                                onClick={() => setShowContractForm(false)}
                                className="px-6 py-3 border border-white/10 rounded-xl font-bold hover:bg-white/5 transition-all"
                              >
                                CANCEL
                              </button>
                            </div>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </section>
              )}

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <FileText className="text-emerald-500" />
                    Active Agreements
                  </h3>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{contracts.length} Active</span>
                </div>

                {contracts.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center bg-white/[0.02]">
                    <p className="text-zinc-500 mb-2 font-medium">No active contracts found.</p>
                    <p className="text-xs text-zinc-600">Initialize a contract to see it here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contracts.map((contract) => (
                      <div key={contract.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <FileText className="text-emerald-500" />
                          </div>
                          <div>
                            <h4 className="font-bold">{contract.vehicleDetails?.year} {contract.vehicleDetails?.make} {contract.vehicleDetails?.model}</h4>
                            <p className="text-xs text-zinc-500 font-mono uppercase tracking-tighter">ID: {contract.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-12 text-center">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Balance</p>
                            <p className="font-bold text-emerald-500">${contract.totalBalance.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Paid</p>
                            <p className="font-bold text-white">${contract.totalPaid.toLocaleString()}</p>
                          </div>
                          {contract.paymentSchedule && (
                            <div className="hidden lg:block">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Schedule</p>
                              <p className="font-bold text-zinc-300 text-xs">{contract.paymentSchedule.frequency} • ${contract.paymentSchedule.installmentAmount}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {isAdmin && contract.status === 'ACTIVE' && (
                            <button 
                              onClick={() => markAsDelinquent(contract)}
                              className="px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold rounded-lg uppercase tracking-wider hover:bg-amber-500/20 transition-all"
                            >
                              Flag Delinquent
                            </button>
                          )}
                          {!isAdmin && contract.status === 'ACTIVE' && (
                            <button 
                              onClick={() => {
                                setSelectedContract(contract);
                                setPaymentAmount(contract.paymentSchedule?.installmentAmount || 0);
                                setShowPaymentModal(true);
                              }}
                              className="px-4 py-2 bg-emerald-500 text-black text-[10px] font-bold rounded-lg uppercase tracking-wider hover:bg-emerald-400 transition-all"
                            >
                              Pay Now
                            </button>
                          )}
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            {contract.status}
                          </span>
                          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white">
                            <Activity size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Award className="text-emerald-500" />
                    Digital Titles
                  </h3>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{certificates.length} Issued</span>
                </div>

                {certificates.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center bg-white/[0.02]">
                    <p className="text-zinc-500 mb-2 font-medium">No digital titles issued yet.</p>
                    <p className="text-xs text-zinc-600">Complete your rent-to-own contract to unlock your title.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {certificates.map((cert) => (
                      <motion.div 
                        key={cert.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-zinc-900 to-black border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Award size={120} />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.2em]">Official Digital Title</span>
                          </div>
                          <h4 className="text-xl font-bold mb-1">{cert.vehicleDetails?.make} {cert.vehicleDetails?.model}</h4>
                          <p className="text-xs text-zinc-500 mb-6">VIN: {cert.vehicleDetails?.vin || 'SIM-VIN-8829'}</p>
                          
                          <div className="grid grid-cols-2 gap-4 mb-8">
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Owner</p>
                              <p className="text-xs font-bold text-zinc-300">{cert.ownerName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Issued At</p>
                              <p className="text-xs font-bold text-zinc-300">
                                {cert.issuedAt?.toDate ? cert.issuedAt.toDate().toLocaleDateString() : 'Processing...'}
                              </p>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-zinc-600 uppercase">{cert.certificateId}</span>
                            <button className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:underline">Download PDF</button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <CreditCard className="text-emerald-500" />
                    Payment History
                  </h3>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{payments.length} Transactions</span>
                </div>

                {payments.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center bg-white/[0.02]">
                    <p className="text-zinc-500 mb-2 font-medium">No payment records found.</p>
                    <p className="text-xs text-zinc-600">Your transaction history will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</th>
                          <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Contract</th>
                          <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reference</th>
                          <th className="p-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="p-4">
                              <p className="text-xs font-medium text-white">
                                {payment.timestamp?.toDate ? payment.timestamp.toDate().toLocaleDateString() : 'Pending...'}
                              </p>
                              <p className="text-[10px] text-zinc-500">
                                {payment.timestamp?.toDate ? payment.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </td>
                            <td className="p-4">
                              <p className="text-xs font-bold text-zinc-300">
                                {contracts.find(c => c.id === payment.contractId)?.vehicleDetails?.make || 'Vehicle'} 
                                {' '}
                                {contracts.find(c => c.id === payment.contractId)?.vehicleDetails?.model || ''}
                              </p>
                            </td>
                            <td className="p-4">
                              <p className="text-[10px] font-mono text-zinc-500 uppercase">{payment.stripeId}</p>
                            </td>
                            <td className="p-4 text-right">
                              <p className="text-sm font-bold text-emerald-500">+${payment.amount.toLocaleString()}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3">
                    <Car className="text-emerald-500" />
                    Available Fleet
                  </h3>
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">{vehicles.length} Units</span>
                </div>

                {vehicles.length === 0 ? (
                  <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center bg-white/[0.02]">
                    <p className="text-zinc-500 mb-2 font-medium">No vehicles in inventory yet.</p>
                    <p className="text-xs text-zinc-600">Admin needs to populate the fleet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="bg-white/[0.03] border border-white/5 rounded-3xl overflow-hidden hover:border-emerald-500/30 transition-all group flex flex-col">
                        <div className="relative h-48 w-full bg-zinc-800">
                          <Image
                            src={getVehicleImage(vehicle)}
                            alt={`${vehicle.make} ${vehicle.model}`}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 right-4">
                            <span className={`px-3 py-1 bg-black/60 backdrop-blur-md text-[10px] font-bold rounded-full uppercase tracking-wider border border-white/10 ${vehicle.status === 'AVAILABLE' ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {vehicle.status}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-6 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-bold">{vehicle.make} {vehicle.model}</h4>
                              <p className="text-sm text-zinc-500">{vehicle.year}</p>
                            </div>
                          </div>
                          
                          <div className="mt-auto flex items-end justify-between">
                            <p className="text-2xl font-black text-emerald-500">${vehicle.price.toLocaleString()}</p>
                            <button className="text-xs font-bold underline underline-offset-4 hover:text-emerald-500 transition-colors">VIEW DETAILS</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-8">
              <section className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 sticky top-32">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="text-emerald-500" />
                  <h3 className="text-xl font-bold">System Integrity</h3>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Database Status</span>
                    <span className="flex items-center gap-2 text-emerald-500 font-bold">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      CONNECTED
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Last Audit</span>
                    <span className="font-mono text-zinc-400">NEVER</span>
                  </div>
                </div>

                <button 
                  onClick={runAudit}
                  disabled={isAuditing}
                  className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  {isAuditing ? (
                    <Activity className="animate-spin" size={20} />
                  ) : (
                    <Shield size={20} />
                  )}
                  {isAuditing ? 'VERIFYING...' : 'RUN SYSTEM AUDIT'}
                </button>

                <AnimatePresence>
                  {auditLogs.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-6 pt-6 border-t border-white/5"
                    >
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Audit Results</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {auditLogs.map((log, i) => (
                          <div key={i} className={`text-xs font-mono p-3 rounded-lg flex gap-3 ${log.startsWith('[SUCCESS]') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
                            {log.startsWith('[SUCCESS]') ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                            <span>{log}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-emerald-500" />
                  Phase 1 Status
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Foundation layer active. Auth, Firestore, and Audit Service initialized. Ready for Phase 2: Contract Engine.
                </p>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {showPaymentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPaymentModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-zinc-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-3">
                    <CreditCard className="text-emerald-500" />
                    Make a Payment
                  </h3>
                  <button onClick={() => setShowPaymentModal(false)} className="text-zinc-500 hover:text-white">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handlePayment} className="space-y-6">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Vehicle</p>
                    <p className="font-bold text-sm">
                      {selectedContract?.vehicleDetails?.year} {selectedContract?.vehicleDetails?.make} {selectedContract?.vehicleDetails?.model}
                    </p>
                    <div className="mt-4 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Remaining Balance</p>
                        <p className="text-lg font-bold text-emerald-500">${selectedContract?.totalBalance.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Scheduled Amount</p>
                        <p className="font-bold text-zinc-300">${selectedContract?.paymentSchedule?.installmentAmount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Payment Amount ($)</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      max={selectedContract?.totalBalance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>

                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
                    <Shield size={16} className="text-emerald-500 mt-0.5" />
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      You will be redirected to Stripe to complete your payment securely. Your contract will update automatically upon success.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-emerald-500 text-black py-4 rounded-xl font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <CreditCard size={18} />
                        <span>PAY WITH STRIPE</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-white/5 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">© 2026 DRIVE HOME SYSTEMS • 777 INTEGRITY</p>
          <div className="flex gap-8">
            <a href="#" className="text-zinc-500 hover:text-white text-xs font-bold transition-colors">TERMS</a>
            <a href="#" className="text-zinc-500 hover:text-white text-xs font-bold transition-colors">PRIVACY</a>
            <a href="#" className="text-zinc-500 hover:text-white text-xs font-bold transition-colors">AUDIT LOGS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function DriveHomeApp() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>}>
      <DriveHomeContent />
    </Suspense>
  );
}
