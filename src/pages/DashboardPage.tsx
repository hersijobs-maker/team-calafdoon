import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { Users, User, Calendar, MapPin, Heart, ArrowRight, Globe, Home, Briefcase, MessageCircle } from 'lucide-react';

export function DashboardPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Bogga Koowaad</h1>
          <p className="text-slate-600 mt-1">Soo dhawoow, {profile.full_name.split(' ')[0]}!</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Diiwaangelinta</p>
                <p className="text-sm font-semibold text-slate-900">{memberSince}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Xaaladaha Akoonka</p>
                <p className="text-sm font-semibold text-emerald-600">Ansaxay & Firfircoon</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Heart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Jinsiga / Da'da</p>
                <p className="text-sm font-semibold text-slate-900">
                  {profile.gender === 'male' ? 'Rag' : profile.gender === 'female' ? 'Haween' : '—'}
                  {profile.age ? ` · ${profile.age} sano` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Profiilkaaga</h2>
            <div className="flex items-center gap-4 mb-6">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-16 h-16 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-semibold text-slate-600">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{profile.full_name}</p>
                <p className="text-sm text-slate-500">{profile.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {profile.country && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Globe className="w-4 h-4 text-slate-400" />
                  {profile.country}
                </div>
              )}
              {profile.city && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Home className="w-4 h-4 text-slate-400" />
                  {profile.city}
                </div>
              )}
              {profile.profession && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  {profile.profession}
                </div>
              )}
              {profile.bio && (
                <p className="text-slate-600 mt-3 leading-relaxed">{profile.bio}</p>
              )}
            </div>
            <Link
              to="/profile"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:gap-2 transition-all"
            >
              Wax beddel Profiilka <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Hawlaha Degdega ah</h2>
            <div className="space-y-3">
              <Link
                to="/members"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Bulshada Xubnaha</p>
                    <p className="text-sm text-slate-500">Arag xubnaha ansaxay</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </Link>

              <Link
                to="/profile"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Profiilkayga</p>
                    <p className="text-sm text-slate-500">Cusboonaysii macluumaadkaaga</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </Link>

              <Link
                to="/chat"
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Fariimaha</p>
                    <p className="text-sm text-slate-500">Wada hadal xubnaha kale</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
