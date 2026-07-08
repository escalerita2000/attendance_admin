'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  FileText, 
  LogOut, 
  Plus, 
  Search, 
  Download, 
  QrCode, 
  CheckCircle, 
  XCircle,
  Smartphone,
  Calendar,
  Layers,
  Settings,
  Edit,
  Trash2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// Tipos de datos
interface Empleado {
  id: string;
  nombre: string;
  codigo_vinculacion: string;
  hora_entrada: string;
  hora_salida: string;
  dias_laborales: number[];
  dispositivos?: {
    device_uuid: string;
    modelo: string;
    os_version: string;
    vinculado_at: string;
  } | null;
}

interface PuntoAsistencia {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
}

interface RegistroAsistencia {
  id: string;
  empleados: { nombre: string };
  puntos_asistencia?: { nombre: string } | null;
  fecha_hora_dispositivo: string;
  fecha_hora_servidor: string;
  latitud_registro: number;
  longitud_registro: number;
  tipo_registro: 'entrada' | 'salida';
  offline_flag: boolean;
  gps_valid: boolean;
}

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'empleados' | 'puntos' | 'reportes'>('dashboard');

  // Datos del backend
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [puntos, setPuntos] = useState<PuntoAsistencia[]>([]);
  const [registros, setRegistros] = useState<RegistroAsistencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Reportes
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');

  // Modales y formularios
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPuntoModal, setShowPuntoModal] = useState(false);
  const [selectedQR, setSelectedQR] = useState<{ title: string; data: string } | null>(null);

  // Formulario Empleados
  const [empNombre, setEmpNombre] = useState('');
  const [empEntrada, setEmpEntrada] = useState('09:00');
  const [empSalida, setEmpSalida] = useState('18:00');

  // Formulario Puntos
  const [puntoNombre, setPuntoNombre] = useState('');
  const [puntoLat, setPuntoLat] = useState('');
  const [puntoLng, setPuntoLng] = useState('');
  const [puntoRadio, setPuntoRadio] = useState('15');

  // Estados de Edición
  const [editingEmp, setEditingEmp] = useState<Empleado | null>(null);
  const [editEmpNombre, setEditEmpNombre] = useState('');
  const [editEmpEntrada, setEditEmpEntrada] = useState('09:00');
  const [editEmpSalida, setEditEmpSalida] = useState('18:00');

  const [editingPunto, setEditingPunto] = useState<PuntoAsistencia | null>(null);
  const [editPuntoNombre, setEditPuntoNombre] = useState('');
  const [editPuntoLat, setEditPuntoLat] = useState('');
  const [editPuntoLng, setEditPuntoLng] = useState('');
  const [editPuntoRadio, setEditPuntoRadio] = useState('15');

  // Escuchar estado de autenticación
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Cargar datos si hay sesión
  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Empleados con su relación de dispositivo
      const { data: empData, error: empErr } = await supabase
        .from('empleados')
        .select(`
          *,
          dispositivos(device_uuid, modelo, os_version, vinculado_at)
        `)
        .order('nombre');

      if (empErr) throw empErr;
      
      // Mapear dispositivos
      const mappedEmp = (empData || []).map((e: any) => ({
        ...e,
        dispositivos: e.dispositivos && e.dispositivos.length > 0 ? e.dispositivos[0] : null
      }));
      setEmpleados(mappedEmp);

      // 2. Cargar Puntos de Asistencia
      const { data: ptData, error: ptErr } = await supabase
        .from('puntos_asistencia')
        .select('*')
        .order('nombre');

      if (ptErr) throw ptErr;
      setPuntos(ptData || []);

      // 3. Cargar Registros de Asistencia
      const { data: regData, error: regErr } = await supabase
        .from('registros_asistencia')
        .select(`
          *,
          empleados(nombre),
          puntos_asistencia(nombre)
        `)
        .order('fecha_hora_dispositivo', { ascending: false });

      if (regErr) throw regErr;
      setRegistros(regData || []);

    } catch (error: any) {
      console.error('Error al cargar datos:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Authentication Error:', error);
        setAuthError(`Credenciales inválidas o error de conexión: ${error.message}`);
      }
    } catch (err: any) {
      console.error('Connection Exception:', err);
      setAuthError('Error de red o de conexión. Verifica tu conexión a internet.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Crear Empleado
  const handleCreateEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empNombre) return;

    // Generar código de vinculación aleatorio de 6 dígitos
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
      const { error } = await supabase.from('empleados').insert({
        nombre: empNombre,
        codigo_vinculacion: code,
        hora_entrada: empEntrada,
        hora_salida: empSalida,
        dias_laborales: [1, 2, 3, 4, 5] // Lun - Vie por defecto
      });

      if (error) throw error;
      
      setShowEmpModal(false);
      setEmpNombre('');
      setEmpEntrada('09:00');
      setEmpSalida('18:00');
      fetchData();
    } catch (err: any) {
      alert('Error al crear empleado: ' + err.message);
    }
  };

  // Crear Punto de Asistencia
  const handleCreatePunto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puntoNombre || !puntoLat || !puntoLng) return;

    try {
      const { error } = await supabase.from('puntos_asistencia').insert({
        nombre: puntoNombre,
        latitud: parseFloat(puntoLat),
        longitud: parseFloat(puntoLng),
        radio_metros: parseFloat(puntoRadio)
      });

      if (error) throw error;

      setShowPuntoModal(false);
      setPuntoNombre('');
      setPuntoLat('');
      setPuntoLng('');
      setPuntoRadio('15');
      fetchData();
    } catch (err: any) {
      alert('Error al crear punto de asistencia: ' + err.message);
    }
  };

  // Modificar Empleado
  const handleUpdateEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editEmpNombre) return;

    try {
      const { error } = await supabase
        .from('empleados')
        .update({
          nombre: editEmpNombre,
          hora_entrada: editEmpEntrada,
          hora_salida: editEmpSalida,
        })
        .eq('id', editingEmp.id);

      if (error) throw error;
      
      setEditingEmp(null);
      fetchData();
    } catch (err: any) {
      alert('Error al actualizar empleado: ' + err.message);
    }
  };

  // Eliminar Empleado
  const handleDeleteEmpleado = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este empleado? Se borrarán todos sus registros y vinculaciones.')) return;
    try {
      const { error } = await supabase.from('empleados').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar empleado: ' + err.message);
    }
  };

  // Modificar Punto
  const handleUpdatePunto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPunto || !editPuntoNombre || !editPuntoLat || !editPuntoLng) return;

    try {
      const { error } = await supabase
        .from('puntos_asistencia')
        .update({
          nombre: editPuntoNombre,
          latitud: parseFloat(editPuntoLat),
          longitud: parseFloat(editPuntoLng),
          radio_metros: parseFloat(editPuntoRadio),
        })
        .eq('id', editingPunto.id);

      if (error) throw error;

      setEditingPunto(null);
      fetchData();
    } catch (err: any) {
      alert('Error al actualizar punto: ' + err.message);
    }
  };

  // Eliminar Punto
  const handleDeletePunto = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este punto de asistencia?')) return;
    try {
      const { error } = await supabase.from('puntos_asistencia').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar punto de asistencia: ' + err.message);
    }
  };

  // Descargar Reporte CSV
  const downloadCSV = () => {
    const headers = ['Empleado', 'Tipo', 'Fecha Hora Dispositivo', 'Ubicacion', 'Modo', 'GPS Valido', 'Latitud', 'Longitud'];
    const rows = filteredRegistros.map(r => [
      r.empleados?.nombre || 'Desconocido',
      r.tipo_registro.toUpperCase(),
      new Date(r.fecha_hora_dispositivo).toLocaleString('es-MX'),
      r.puntos_asistencia?.nombre || 'N/A',
      r.offline_flag ? 'Offline' : 'Online',
      r.gps_valid ? 'Valido' : 'Invalido',
      r.latitud_registro,
      r.longitud_registro
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_asistencias_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtros aplicados a registros
  const filteredRegistros = registros.filter(r => {
    const matchesSearch = r.empleados?.nombre.toLowerCase().includes(searchFilter.toLowerCase()) || 
                          (r.puntos_asistencia?.nombre || '').toLowerCase().includes(searchFilter.toLowerCase());
    
    const matchesDate = dateFilter ? r.fecha_hora_dispositivo.startsWith(dateFilter) : true;
    
    const matchesType = typeFilter === 'todos' ? true : r.tipo_registro === typeFilter;

    return matchesSearch && matchesDate && matchesType;
  });

  // Cálculos del Dashboard
  const getDashboardStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const registrosHoy = registros.filter(r => r.fecha_hora_dispositivo.startsWith(today));
    
    const entradasHoy = registrosHoy.filter(r => r.tipo_registro === 'entrada');
    const salidasHoy = registrosHoy.filter(r => r.tipo_registro === 'salida');
    
    // Alertas GPS hoy
    const alertasGpsHoy = registrosHoy.filter(r => !r.gps_valid).length;

    // Calcular impuntuales de hoy (registros de entrada que superan su hora_entrada programada)
    let retrasosHoy = 0;
    entradasHoy.forEach(reg => {
      // Buscar el horario de entrada programado para este empleado
      const emp = empleados.find(e => e.nombre === reg.empleados.nombre);
      if (emp) {
        const checkTime = new Date(reg.fecha_hora_dispositivo);
        const [h, m] = emp.hora_entrada.split(':');
        const limitTime = new Date(checkTime);
        limitTime.setHours(parseInt(h), parseInt(m), 0);

        if (checkTime.getTime() > limitTime.getTime()) {
          retrasosHoy++;
        }
      }
    });

    return {
      activos: empleados.length,
      asistenciaHoy: entradasHoy.length,
      salidasHoy: salidasHoy.length,
      alertasGPS: alertasGpsHoy,
      retrasos: retrasosHoy
    };
  };

  const stats = getDashboardStats();

  // Datos de gráfico: asistencia en los últimos 7 días
  const getChartData = () => {
    const daysData: { [key: string]: { date: string; entradas: number; salidas: number } } = {};
    
    // Inicializar últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      daysData[dateStr] = {
        date: d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        entradas: 0,
        salidas: 0
      };
    }

    // Llenar datos de registros
    registros.forEach(r => {
      const dateKey = r.fecha_hora_dispositivo.split('T')[0];
      if (daysData[dateKey]) {
        if (r.tipo_registro === 'entrada') daysData[dateKey].entradas++;
        if (r.tipo_registro === 'salida') daysData[dateKey].salidas++;
      }
    });

    return Object.values(daysData);
  };

  const chartData = getChartData();

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#070b13] p-4 text-white">
        <div className="w-full max-w-md bg-[#0f172a] rounded-3xl border border-[#1e293b] p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Admin Asistencia</h1>
            <p className="text-sm text-slate-400 mt-2">Ingresa tus credenciales para acceder al panel.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Correo Electrónico</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-[#334155] focus:border-indigo-500 focus:outline-none transition-colors"
                placeholder="admin@correo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Contraseña</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-[#334155] focus:border-indigo-500 focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <p className="text-sm text-rose-500 font-medium">{authError}</p>
            )}

            <button 
              type="submit"
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold text-white shadow-lg shadow-indigo-600/20"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-white flex">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-[#1e293b] bg-[#0c1222] p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg block">Asistencia</span>
              <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">Panel Web</span>
            </div>
          </div>

          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-white'}`}
            >
              <Layers className="w-5 h-5" /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('empleados')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'empleados' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-white'}`}
            >
              <Users className="w-5 h-5" /> Empleados
            </button>
            <button 
              onClick={() => setActiveTab('puntos')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'puntos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-white'}`}
            >
              <MapPin className="w-5 h-5" /> Puntos QR
            </button>
            <button 
              onClick={() => setActiveTab('reportes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'reportes' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:bg-[#1e293b]/50 hover:text-white'}`}
            >
              <FileText className="w-5 h-5" /> Reportes
            </button>
          </nav>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
        >
          <LogOut className="w-5 h-5" /> Cerrar Sesión
        </button>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium text-sm">Cargando información del sistema...</p>
            </div>
          </div>
        ) : (
          <>
            {/* TAB DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight">Resumen General</h2>
                  <p className="text-slate-400 mt-1">Estadísticas y estado de asistencia en tiempo real.</p>
                </div>

                {/* INDICADORES CLAVE */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-slate-400">Total Empleados</span>
                      <Users className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-3xl font-black">{stats.activos}</span>
                  </div>
                  
                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-slate-400">Asistencia Entrada Hoy</span>
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <span className="text-3xl font-black text-emerald-400">{stats.asistenciaHoy}</span>
                  </div>

                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-slate-400">Salidas Marcadas Hoy</span>
                      <XCircle className="w-5 h-5 text-rose-400" />
                    </div>
                    <span className="text-3xl font-black text-rose-400">{stats.salidasHoy}</span>
                  </div>

                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-slate-400">Retrasos Hoy</span>
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-3xl font-black text-amber-400">{stats.retrasos}</span>
                  </div>

                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b]">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm font-semibold text-slate-400">Alertas GPS Hoy</span>
                      <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                    </div>
                    <span className="text-3xl font-black text-rose-500">{stats.alertasGPS}</span>
                  </div>
                </div>

                {/* GRÁFICO Y ALERTAS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Gráfico */}
                  <div className="lg:col-span-2 bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] flex flex-col justify-between">
                    <h3 className="text-lg font-bold mb-6">Asistencia Últimos 7 Días</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="date" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" allowDecimals={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                          <Area type="monotone" dataKey="entradas" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEntradas)" name="Entradas" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Alertas Recientes */}
                  <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] flex flex-col">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" /> Alertas del Sistema
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-4 max-h-80">
                      {registros.filter(r => !r.gps_valid || r.offline_flag).slice(0, 8).map(r => (
                        <div key={r.id} className="p-3.5 rounded-xl bg-[#1e293b]/50 border border-[#334155] text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold">{r.empleados?.nombre}</span>
                            <span className="text-[11px] text-slate-500">{new Date(r.fecha_hora_dispositivo).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            Marcó {r.tipo_registro} en {r.puntos_asistencia?.nombre || 'QR Desconocido'}.
                          </p>
                          <div className="flex gap-2 mt-2">
                            {!r.gps_valid && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Fuera de Zona (GPS)
                              </span>
                            )}
                            {r.offline_flag && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Registro Offline
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {registros.filter(r => !r.gps_valid || r.offline_flag).length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-8">No se han registrado incidencias.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB EMPLEADOS */}
            {activeTab === 'empleados' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Gestión de Empleados</h2>
                    <p className="text-slate-400 mt-1">Crea empleados y genera códigos de vinculación de celular.</p>
                  </div>
                  <button 
                    onClick={() => setShowEmpModal(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold text-sm shadow-lg shadow-indigo-600/15"
                  >
                    <Plus className="w-5 h-5" /> Agregar Empleado
                  </button>
                </div>

                <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e293b] bg-[#0c1222]/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="p-4 pl-6">Nombre</th>
                        <th className="p-4">Horario Entrada</th>
                        <th className="p-4">Horario Salida</th>
                        <th className="p-4">Código Enlace</th>
                        <th className="p-4">Dispositivo Vinculado</th>
                        <th className="p-4 pr-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b] text-sm">
                      {empleados.map(emp => (
                        <tr key={emp.id} className="hover:bg-[#1e293b]/30 transition-colors">
                          <td className="p-4 pl-6 font-bold">{emp.nombre}</td>
                          <td className="p-4 text-slate-300">{emp.hora_entrada.substring(0, 5)}</td>
                          <td className="p-4 text-slate-300">{emp.hora_salida.substring(0, 5)}</td>
                          <td className="p-4">
                            <span className="font-mono bg-[#1e293b] px-3 py-1 rounded-lg border border-[#334155] text-indigo-400 font-bold">
                              {emp.codigo_vinculacion}
                            </span>
                          </td>
                          <td className="p-4">
                            {emp.dispositivos ? (
                              <div className="flex items-center gap-2 text-emerald-400">
                                <Smartphone className="w-4 h-4" />
                                <span className="text-xs">{emp.dispositivos.modelo} ({emp.dispositivos.os_version})</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Sin vincular</span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right space-x-2">
                            <button 
                              onClick={() => setSelectedQR({
                                title: `Vinculación: ${emp.nombre}`,
                                data: emp.codigo_vinculacion
                              })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-bold transition-all"
                            >
                              <QrCode className="w-4 h-4" /> QR Enlace
                            </button>
                            <button 
                              onClick={() => {
                                setEditingEmp(emp);
                                setEditEmpNombre(emp.nombre);
                                setEditEmpEntrada(emp.hora_entrada.substring(0, 5));
                                setEditEmpSalida(emp.hora_salida.substring(0, 5));
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all"
                            >
                              <Edit className="w-4 h-4" /> Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteEmpleado(emp.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all"
                            >
                              <Trash2 className="w-4 h-4" /> Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB PUNTOS DE ASISTENCIA */}
            {activeTab === 'puntos' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Puntos de Asistencia QR</h2>
                    <p className="text-slate-400 mt-1">Registra oficinas o sucursales físicas y genera los QR imprimibles.</p>
                  </div>
                  <button 
                    onClick={() => setShowPuntoModal(true)}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold text-sm shadow-lg shadow-indigo-600/15"
                  >
                    <Plus className="w-5 h-5" /> Registrar Oficina/Punto
                  </button>
                </div>

                {/* QR UNICO GLOBAL CARD */}
                <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-indigo-400">Código QR Único de Asistencia</h3>
                    <p className="text-slate-400 text-sm max-w-2xl text-left">
                      Este es un código QR único global para toda la organización. Puedes imprimir este único código y colocarlo en cualquiera de tus oficinas. La aplicación móvil detectará automáticamente en cuál oficina se encuentra el empleado mediante GPS.
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedQR({
                      title: "Código QR Único de Asistencia",
                      data: JSON.stringify({ type: "attendance_global", system: "flux-register" })
                    })}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold text-sm shadow-lg shadow-indigo-600/15 whitespace-nowrap"
                  >
                    <QrCode className="w-5 h-5" /> Mostrar QR Único
                  </button>
                </div>

                <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e293b] bg-[#0c1222]/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="p-4 pl-6">Nombre del Punto</th>
                        <th className="p-4">Latitud</th>
                        <th className="p-4">Longitud</th>
                        <th className="p-4">Radio Permitido</th>
                        <th className="p-4 pr-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b] text-sm">
                      {puntos.map(pt => {
                        const qrPayload = JSON.stringify({
                          lat: pt.latitud,
                          lng: pt.longitud,
                          location_id: pt.id,
                          location_name: pt.nombre
                        });
                        return (
                          <tr key={pt.id} className="hover:bg-[#1e293b]/30 transition-colors">
                            <td className="p-4 pl-6 font-bold">{pt.nombre}</td>
                            <td className="p-4 font-mono text-slate-300">{pt.latitud}</td>
                            <td className="p-4 font-mono text-slate-300">{pt.longitud}</td>
                            <td className="p-4 text-slate-300">{pt.radio_metros} metros</td>
                            <td className="p-4 pr-6 text-right space-x-2">
                              <button 
                                onClick={() => setSelectedQR({
                                  title: `QR Asistencia: ${pt.nombre}`,
                                  data: qrPayload
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all"
                              >
                                <QrCode className="w-4 h-4" /> Mostrar QR
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingPunto(pt);
                                  setEditPuntoNombre(pt.nombre);
                                  setEditPuntoLat(pt.latitud.toString());
                                  setEditPuntoLng(pt.longitud.toString());
                                  setEditPuntoRadio(pt.radio_metros.toString());
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all"
                              >
                                <Edit className="w-4 h-4" /> Editar
                              </button>
                              <button 
                                onClick={() => handleDeletePunto(pt.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition-all"
                              >
                                <Trash2 className="w-4 h-4" /> Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB REPORTES */}
            {activeTab === 'reportes' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight">Reporte de Asistencias</h2>
                    <p className="text-slate-400 mt-1">Busca, filtra y descarga el historial de registros de asistencia.</p>
                  </div>
                  <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors font-bold text-sm shadow-lg shadow-indigo-600/15"
                  >
                    <Download className="w-5 h-5" /> Exportar CSV
                  </button>
                </div>

                {/* FILTROS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#0f172a] p-4 rounded-xl border border-[#1e293b]">
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar empleado o punto..."
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <input 
                      type="date" 
                      value={dateFilter}
                      onChange={e => setDateFilter(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>
                  <div>
                    <select
                      value={typeFilter}
                      onChange={e => setTypeFilter(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm text-slate-300"
                    >
                      <option value="todos">Todos los Tipos</option>
                      <option value="entrada">Entradas</option>
                      <option value="salida">Salidas</option>
                    </select>
                  </div>
                </div>

                {/* TABLA */}
                <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e293b] bg-[#0c1222]/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="p-4 pl-6">Empleado</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Fecha y Hora</th>
                        <th className="p-4">Punto</th>
                        <th className="p-4">Modo</th>
                        <th className="p-4 pr-6">GPS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b] text-sm">
                      {filteredRegistros.map(reg => (
                        <tr key={reg.id} className="hover:bg-[#1e293b]/30 transition-colors">
                          <td className="p-4 pl-6 font-bold">{reg.empleados?.nombre || 'Desconocido'}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${reg.tipo_registro === 'entrada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {reg.tipo_registro.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300">
                            {new Date(reg.fecha_hora_dispositivo).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 text-slate-300">
                            {reg.puntos_asistencia?.nombre || 'N/A'}
                          </td>
                          <td className="p-4">
                            <span className={`text-xs ${reg.offline_flag ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                              {reg.offline_flag ? 'Sincronizado Offline' : 'Directo Online'}
                            </span>
                          </td>
                          <td className="p-4 pr-6">
                            <div className="flex items-center gap-1.5">
                              {reg.gps_valid ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                                  <span className="text-xs text-emerald-500 font-semibold">Dentro de Rango</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                                  <span className="text-xs text-rose-500 font-semibold">Fuera de Rango</span>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredRegistros.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">No se encontraron registros de asistencia.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL EMPLEADO */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0f172a] rounded-3xl border border-[#1e293b] p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Nuevo Empleado</h3>
            <form onSubmit={handleCreateEmpleado} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Nombre Completo</label>
                <input 
                  type="text" 
                  required
                  value={empNombre}
                  onChange={e => setEmpNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Hora Entrada</label>
                  <input 
                    type="time" 
                    required
                    value={empEntrada}
                    onChange={e => setEmpEntrada(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Hora Salida</label>
                  <input 
                    type="time" 
                    required
                    value={empSalida}
                    onChange={e => setEmpSalida(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm text-slate-300"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-[#1e293b] transition-colors text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-bold shadow-lg shadow-indigo-600/15"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PUNTO ASISTENCIA */}
      {showPuntoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0f172a] rounded-3xl border border-[#1e293b] p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Nuevo Punto de Asistencia</h3>
            <form onSubmit={handleCreatePunto} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Nombre de la Sucursal/Oficina</label>
                <input 
                  type="text" 
                  required
                  value={puntoNombre}
                  onChange={e => setPuntoNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Ej. Oficina Central - Recepción"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Latitud</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={puntoLat}
                    onChange={e => setPuntoLat(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm font-mono"
                    placeholder="Ej. 19.4326"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Longitud</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={puntoLng}
                    onChange={e => setPuntoLng(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm font-mono"
                    placeholder="Ej. -99.1332"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Radio de Tolerancia (metros)</label>
                <input 
                  type="number" 
                  required
                  value={puntoRadio}
                  onChange={e => setPuntoRadio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="15"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setShowPuntoModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-[#1e293b] transition-colors text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-bold shadow-lg shadow-indigo-600/15"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MOSTRAR QR */}
      {selectedQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-[#0f172a] rounded-3xl border border-[#1e293b] p-8 shadow-2xl text-center">
            <h3 className="text-lg font-bold mb-2">{selectedQR.title}</h3>
            <p className="text-xs text-slate-400 mb-6">Imprime este código QR o compártelo para escanear en la app móvil.</p>
            
            {/* Generación dinámica de QR via API QRServer */}
            <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-lg">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedQR.data)}`} 
                alt="Código QR"
                className="w-48 h-48"
              />
            </div>

            <div className="bg-[#1e293b] p-3 rounded-xl border border-[#334155] mb-6 text-left">
              <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Carga útil del QR</span>
              <code className="text-xs font-mono break-all text-slate-300">
                {selectedQR.data}
              </code>
            </div>

            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setSelectedQR(null)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-bold w-full"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR EMPLEADO */}
      {editingEmp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0f172a] rounded-3xl border border-[#1e293b] p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Editar Empleado</h3>
            <form onSubmit={handleUpdateEmpleado} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Nombre Completo</label>
                <input 
                  type="text" 
                  required
                  value={editEmpNombre}
                  onChange={e => setEditEmpNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Hora Entrada</label>
                  <input 
                    type="time" 
                    required
                    value={editEmpEntrada}
                    onChange={e => setEditEmpEntrada(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm text-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Hora Salida</label>
                  <input 
                    type="time" 
                    required
                    value={editEmpSalida}
                    onChange={e => setEditEmpSalida(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm text-slate-300"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-[#1e293b] transition-colors text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-bold shadow-lg shadow-indigo-600/15"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PUNTO ASISTENCIA */}
      {editingPunto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#0f172a] rounded-3xl border border-[#1e293b] p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">Editar Punto de Asistencia</h3>
            <form onSubmit={handleUpdatePunto} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Nombre de la Sucursal/Oficina</label>
                <input 
                  type="text" 
                  required
                  value={editPuntoNombre}
                  onChange={e => setEditPuntoNombre(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Ej. Oficina Central - Recepción"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Latitud</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={editPuntoLat}
                    onChange={e => setEditPuntoLat(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm font-mono"
                    placeholder="Ej. 19.4326"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Longitud</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    value={editPuntoLng}
                    onChange={e => setEditPuntoLng(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm font-mono"
                    placeholder="Ej. -99.1332"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Radio de Tolerancia (metros)</label>
                <input 
                  type="number" 
                  required
                  value={editPuntoRadio}
                  onChange={e => setEditPuntoRadio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-[#334155] focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="15"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingPunto(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-[#1e293b] transition-colors text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-bold shadow-lg shadow-indigo-600/15"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
