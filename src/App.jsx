import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { LogOut, Plus, X, Check } from 'lucide-react';

const isDateInCurrentWeek = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today.getFullYear(), today.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return d >= monday && d <= sunday;
};

const STATUS_OPTIONS = [
  { value: 'idee', label: 'Idée', color: 'bg-gray-200 text-gray-800' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-200 text-blue-800' },
  { value: 'tournee', label: 'Tournée', color: 'bg-purple-200 text-purple-800' },
  { value: 'montee', label: 'Montée', color: 'bg-yellow-200 text-yellow-800' },
  { value: 'publiee', label: 'Publiée', color: 'bg-green-200 text-green-800' },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [videos, setVideos] = useState([]);
  const [filterAssignee, setFilterAssignee] = useState('tous');
  const [filterStatus, setFilterStatus] = useState('tous');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session) {
      fetchVideos();
    }
  }, [session]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('date_prevue', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setVideos(data || []);
    }
  };

  const handleStatusChange = async (e, id) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    const { error } = await supabase
      .from('videos')
      .update({ statut: newStatus })
      .eq('id', id);
    if (!error) fetchVideos();
  };

  const handleMarkAsDone = async (e, id) => {
    e.stopPropagation();
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('videos')
      .update({ statut: 'publiee', date_publiee: today })
      .eq('id', id);
    if (!error) fetchVideos();
  };

  const openPanel = (video = null) => {
    if (video) {
      setFormData(video);
    } else {
      setFormData({
        titre: '',
        idee: '',
        assigne_a: 'moi',
        statut: 'idee',
        date_prevue: '',
        date_publiee: '',
        commentaires: ''
      });
    }
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    setFormData({});
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (!payload.date_prevue) payload.date_prevue = null;
    if (!payload.date_publiee) payload.date_publiee = null;

    if (payload.id) {
      const { error } = await supabase.from('videos').update(payload).eq('id', payload.id);
      if (!error) {
        closePanel();
        fetchVideos();
      } else {
        alert(error.message);
      }
    } else {
      const { error } = await supabase.from('videos').insert([payload]);
      if (!error) {
        closePanel();
        fetchVideos();
      } else {
        alert(error.message);
      }
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow max-w-sm w-full border border-gray-200">
          <h1 className="text-2xl font-semibold mb-6 text-center text-gray-900">Connexion</h1>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
            <input
              type="email"
              required
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-gray-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1 text-gray-700">Mot de passe</label>
            <input
              type="password"
              required
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:border-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-black text-white p-2 rounded hover:bg-gray-800">Se connecter</button>
        </form>
      </div>
    );
  }

  const filteredVideos = videos.filter(v => {
    if (filterAssignee !== 'tous' && v.assigne_a !== filterAssignee) return false;
    if (filterStatus === 'publiees' && v.statut !== 'publiee') return false;
    if (filterStatus === 'non_publiees' && v.statut === 'publiee') return false;
    return true;
  });

  const getStats = (assignee) => {
    let prevues = 0;
    let faites = 0;
    videos.forEach(v => {
      if (assignee && v.assigne_a !== assignee) return;
      if (isDateInCurrentWeek(v.date_prevue)) prevues++;
      if (v.statut === 'publiee' && isDateInCurrentWeek(v.date_publiee)) faites++;
    });
    return { prevues, faites };
  };

  const statsTotal = getStats();
  const statsMoi = getStats('moi');
  const statsPartenaire = getStats('partenaire');

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col relative">
      <header className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Suivi Vidéos</h1>
          </div>

          <div className="flex-1 w-full sm:max-w-md mx-4 bg-gray-100 p-2 rounded flex flex-col items-center justify-center text-sm border border-gray-200">
            <div className="font-semibold mb-1 text-gray-800">Semaine en cours : {statsTotal.faites} / {statsTotal.prevues}</div>
            <div className="flex gap-4 text-xs w-full justify-center">
              <div className="bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
                <span className="font-medium text-gray-500 mr-1">Moi</span>
                <span className="font-bold text-gray-900">{statsMoi.faites}/{statsMoi.prevues}</span>
              </div>
              <div className="bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
                <span className="font-medium text-gray-500 mr-1">Partenaire</span>
                <span className="font-bold text-gray-900">{statsPartenaire.faites}/{statsPartenaire.prevues}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => openPanel()} className="flex items-center gap-1 bg-black text-white px-3 py-2 rounded text-sm hover:bg-gray-800">
              <Plus size={16} /> Nouvelle vidéo
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1 bg-gray-200 px-3 py-2 rounded text-sm hover:bg-gray-300">
              <LogOut size={16} /> Quitter
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <div className="mb-4 flex flex-col sm:flex-row gap-4 bg-white p-4 rounded border border-gray-200">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1">Filtre Personne</label>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="border border-gray-300 rounded p-1.5 text-sm"
            >
              <option value="tous">Tous</option>
              <option value="moi">Moi</option>
              <option value="partenaire">Partenaire</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1">Filtre Statut</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded p-1.5 text-sm"
            >
              <option value="tous">Tous</option>
              <option value="non_publiees">Non publiées</option>
              <option value="publiees">Publiées</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded border border-gray-200 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <th className="p-3 font-medium">Titre</th>
                <th className="p-3 font-medium">Assigné à</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 font-medium">Date prévue</th>
                <th className="p-3 font-medium">Date publiée</th>
                <th className="p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVideos.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-500">Aucune vidéo trouvée</td>
                </tr>
              ) : (
                filteredVideos.map(video => (
                  <tr
                    key={video.id}
                    onClick={() => openPanel(video)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="p-3 font-medium text-gray-900">{video.titre}</td>
                    <td className="p-3 capitalize">{video.assigne_a}</td>
                    <td className="p-3">
                      <select
                        value={video.statut}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleStatusChange(e, video.id)}
                        className={`text-xs px-2 py-1 border-0 rounded font-medium appearance-none cursor-pointer ${STATUS_OPTIONS.find(o => o.value === video.statut)?.color
                          }`}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} className="bg-white text-black">{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{video.date_prevue || '-'}</td>
                    <td className="p-3 text-sm text-gray-600">{video.date_publiee || '-'}</td>
                    <td className="p-3 text-right">
                      {video.statut !== 'publiee' && (
                        <button
                          onClick={(e) => handleMarkAsDone(e, video.id)}
                          className="bg-green-100 text-green-700 p-1.5 rounded hover:bg-green-200 flex items-center justify-center ml-auto"
                          title="Marquer comme faite"
                        >
                          <Check size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Side Panel */}
      {isPanelOpen && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={closePanel}></div>
          <div className="relative w-full max-w-md bg-white h-full shadow-xl border-l border-gray-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">{formData.id ? 'Éditer la vidéo' : 'Nouvelle vidéo'}</h2>
              <button onClick={closePanel} className="text-gray-500 hover:text-black">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <form id="video-form" onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Titre *</label>
                  <input
                    type="text"
                    required
                    value={formData.titre || ''}
                    onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Idée (description)</label>
                  <textarea
                    rows="3"
                    value={formData.idee || ''}
                    onChange={(e) => setFormData({ ...formData, idee: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Assigné à</label>
                    <select
                      value={formData.assigne_a || 'moi'}
                      onChange={(e) => setFormData({ ...formData, assigne_a: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                    >
                      <option value="moi">Moi</option>
                      <option value="partenaire">Partenaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Statut</label>
                    <select
                      value={formData.statut || 'idee'}
                      onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date prévue</label>
                    <input
                      type="date"
                      value={formData.date_prevue || ''}
                      onChange={(e) => setFormData({ ...formData, date_prevue: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date publiée</label>
                    <input
                      type="date"
                      value={formData.date_publiee || ''}
                      onChange={(e) => setFormData({ ...formData, date_publiee: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Commentaires</label>
                  <textarea
                    rows="4"
                    value={formData.commentaires || ''}
                    onChange={(e) => setFormData({ ...formData, commentaires: e.target.value })}
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:border-black focus:outline-none"
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button onClick={closePanel} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100">
                Annuler
              </button>
              <button type="submit" form="video-form" className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
