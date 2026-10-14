import { useState } from 'react'
import {
  isFirebaseConfigured,
  firebaseConfig,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig,
} from '../../services/firebase'

export default function AdminSettings() {
  const isConfigured = isFirebaseConfigured()

  const [formData, setFormData] = useState({
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || '',
    projectId: firebaseConfig.projectId || '',
    storageBucket: firebaseConfig.storageBucket || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
    measurementId: firebaseConfig.measurementId || '',
  })

  const [copyStatus, setCopyStatus] = useState('')

  const handleSave = (e) => {
    e.preventDefault()
    if (!formData.apiKey.trim() || !formData.projectId.trim()) {
      alert('Please provide at least the Firebase API Key and Project ID.')
      return
    }

    saveCustomFirebaseConfig(formData)
  }

  const handleClear = () => {
    if (window.confirm('Clear custom configuration and revert to environment defaults?')) {
      clearCustomFirebaseConfig()
    }
  }

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopyStatus(label)
    setTimeout(() => setCopyStatus(''), 3000)
  }

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 1. Website Images & Site Settings: Public Read, Write Restricted to Authenticated Admin
    match /website_images/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /site_settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // 2. Admin Privileges Table
    match /admins/{adminId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == adminId;
    }

    // 3. Orders and Customer Data
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
  }
}`

  const storageRulesText = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Public website images are publicly viewable by visitors
    // Uploads, replacements, and deletions restricted to authenticated admins
    match /website-images/{allPaths=**} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
    
    // Default fallback
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
          Firebase Configuration & Security Rules
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your Firebase project connection, credentials, and verify production security rules.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isConfigured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isConfigured ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                {isConfigured ? 'Firebase Connected & Active' : 'Firebase Configuration Needed'}
              </h2>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  isConfigured
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isConfigured ? 'Live' : 'Local Fallback'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {isConfigured
                ? `Connected to Firebase project "${firebaseConfig.projectId}". Storage and Firestore operations are active.`
                : 'Currently running in local fallback mode. Enter your Firebase project credentials below to connect to live Firebase Storage and Cloud Firestore.'}
            </p>
          </div>
        </div>

        {isConfigured && (
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold self-start md:self-auto border border-slate-700"
          >
            Reset Config
          </button>
        )}
      </div>

      {/* Firebase Credentials Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Firebase Project Credentials</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          You can obtain these from the{' '}
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 underline hover:text-amber-300"
          >
            Firebase Console
          </a>{' '}
          under <strong>Project Settings → General → Your Apps → Web App (firebaseConfig)</strong>.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                API Key (apiKey)
              </label>
              <input
                type="text"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Project ID (projectId)
              </label>
              <input
                type="text"
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                placeholder="kandan-family-shop"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Auth Domain (authDomain)
              </label>
              <input
                type="text"
                value={formData.authDomain}
                onChange={(e) => setFormData({ ...formData, authDomain: e.target.value })}
                placeholder="kandan-family-shop.firebaseapp.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Storage Bucket (storageBucket)
              </label>
              <input
                type="text"
                value={formData.storageBucket}
                onChange={(e) => setFormData({ ...formData, storageBucket: e.target.value })}
                placeholder="kandan-family-shop.appspot.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Messaging Sender ID (messagingSenderId)
              </label>
              <input
                type="text"
                value={formData.messagingSenderId}
                onChange={(e) => setFormData({ ...formData, messagingSenderId: e.target.value })}
                placeholder="1029384756"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                App ID (appId)
              </label>
              <input
                type="text"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                placeholder="1:1029384756:web:abcd1234"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Measurement ID (measurementId - Optional Analytics)
              </label>
              <input
                type="text"
                value={formData.measurementId || ''}
                onChange={(e) => setFormData({ ...formData, measurementId: e.target.value })}
                placeholder="G-09NKCBD1MR"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all"
            >
              Save & Connect Firebase
            </button>
          </div>
        </form>
      </div>

      {/* Security Rules Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Firestore Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Cloud Firestore Rules</h3>
                <span className="text-[10px] text-slate-400 font-mono">firestore.rules</span>
              </div>
              <button
                onClick={() => copyToClipboard(firestoreRulesText, 'firestore')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
              >
                {copyStatus === 'firestore' ? 'Copied ✓' : 'Copy Rules'}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-72">
              {firestoreRulesText}
            </pre>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">
            Allows public visitors to read images and content, but restricts all create, update, and delete operations to verified authenticated admin accounts.
          </p>
        </div>

        {/* Storage Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Firebase Storage Rules</h3>
                <span className="text-[10px] text-slate-400 font-mono">storage.rules</span>
              </div>
              <button
                onClick={() => copyToClipboard(storageRulesText, 'storage')}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
              >
                {copyStatus === 'storage' ? 'Copied ✓' : 'Copy Rules'}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-72">
              {storageRulesText}
            </pre>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">
            Images in <code className="text-amber-300">website-images/**</code> are publicly viewable by visitors. File uploads, replacements, and deletions require admin authentication.
          </p>
        </div>
      </div>
    </div>
  )
}
