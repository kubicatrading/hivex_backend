"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { 
  BarChart3, Plus, Trash2, RefreshCw, BarChart, AreaChart as AreaIcon, LineChart as LineIcon
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart as RechartsBarChart, Bar, LineChart as RechartsLineChart, Line
} from "recharts";

interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface ChartDatasetRow {
  label: string;
  val1: number;
  val2: number;
  [key: string]: string | number;
}

interface ChartDocument {
  id: string;
  title: string;
  description?: string;
  type: "chart";
  created_at: string;
  metadata: {
    xAxis: string;
    series: ChartSeries[];
    data: ChartDatasetRow[];
  };
}

export default function ChartsPage() {
  const [charts, setCharts] = useState<ChartDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active chart rendering
  const [selectedChart, setSelectedChart] = useState<ChartDocument | null>(null);
  const [chartType, setChartType] = useState<"area" | "bar" | "line">("area");

  // Form states for creating a new chart
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formFields, setFormFields] = useState<ChartDatasetRow[]>([
    { label: "Ene", val1: 15, val2: 10 },
    { label: "Feb", val1: 22, val2: 15 },
    { label: "Mar", val1: 30, val2: 24 },
    { label: "Abr", val1: 45, val2: 28 },
    { label: "May", val1: 60, val2: 35 }
  ]);
  const [label1, setLabel1] = useState("Ventas");
  const [label2, setLabel2] = useState("Gastos");
  const [color1, setColor1] = useState("#8b5cf6"); // Violet
  const [color2, setColor2] = useState("#10b981"); // Emerald
  const [formLoading, setFormLoading] = useState(false);

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("type", "chart");
      if (error) throw error;
      
      if (data) {
        setCharts(data as ChartDocument[]);
        setSelectedChart(current => {
          if (!current && data.length > 0) {
            return data[0] as ChartDocument;
          }
          return current;
        });
      }
    } catch (err) {
      console.error("Failed to fetch charts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCharts();
  }, [fetchCharts]);

  const handleAddField = () => {
    setFormFields([...formFields, { label: "", val1: 0, val2: 0 }]);
  };

  const handleFieldChange = (index: number, key: string, value: string | number) => {
    const updated = [...formFields];
    updated[index] = {
      ...updated[index],
      [key]: value
    };
    setFormFields(updated);
  };

  const handleRemoveField = (index: number) => {
    if (formFields.length <= 2) return; // Keep at least 2 fields for valid charting
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  const handleCreateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setFormLoading(true);

    try {
      // Structure the data to match standard seed charts
      const formattedData = formFields.map(f => ({
        name: f.label || "Sin etiqueta",
        [label1.toLowerCase()]: Number(f.val1),
        [label2.toLowerCase()]: Number(f.val2)
      }));

      const newChart = {
        title,
        description,
        type: "chart",
        file_url: null,
        metadata: {
          data: formattedData,
          xAxis: "name",
          series: [
            { key: label1.toLowerCase(), label: label1, color: color1 },
            { key: label2.toLowerCase(), label: label2, color: color2 }
          ]
        }
      };

      const { data, error } = await supabase.from("documents").insert(newChart);
      if (error) throw error;

      // Reset form
      setTitle("");
      setDescription("");
      setFormFields([
        { label: "Ene", val1: 15, val2: 10 },
        { label: "Feb", val1: 22, val2: 15 },
        { label: "Mar", val1: 30, val2: 24 }
      ]);
      
      await fetchCharts();
      // Auto select the new chart
      if (data && data[0]) {
        setSelectedChart(data[0]);
      } else {
        // Fallback fetch re-triggers
        fetchCharts();
      }
    } catch (err) {
      console.error("Failed to insert chart:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteChart = async (id: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este gráfico?")) {
      try {
        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) throw error;
        
        const remaining = charts.filter(c => c.id !== id);
        setCharts(remaining);
        
        if (selectedChart?.id === id) {
          setSelectedChart(remaining.length > 0 ? remaining[0] : null);
        }
      } catch (err) {
        console.error("Failed to delete chart:", err);
      }
    }
  };

  return (
    <div className="space-y-10">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-900/60">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Métricas y Gráficos
          </h1>
          <p className="text-zinc-400 font-light mt-1 text-sm md:text-base">
            Renderiza visualizaciones dinámicas locales o introduce tus propios datasets analíticos.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ACTIVE CHART DISPLAY & DATA PREVIEW */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Chart Visualizer Card */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] bg-violet-500/5 blur-[50px] pointer-events-none" />

            {/* Chart Control Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white truncate">
                  {selectedChart ? selectedChart.title : "Cargando visualización..."}
                </h2>
                <p className="text-xs text-zinc-500 truncate max-w-md mt-0.5">
                  {selectedChart ? selectedChart.description : "Por favor selecciona o añade un gráfico..."}
                </p>
              </div>

              {selectedChart && (
                <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400">
                  <button
                    onClick={() => setChartType("area")}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${chartType === "area" ? "bg-violet-600/15 text-violet-400 border border-violet-500/20" : "hover:text-white border border-transparent"}`}
                  >
                    <AreaIcon className="w-3.5 h-3.5" />
                    Área
                  </button>
                  <button
                    onClick={() => setChartType("bar")}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${chartType === "bar" ? "bg-violet-600/15 text-violet-400 border border-violet-500/20" : "hover:text-white border border-transparent"}`}
                  >
                    <BarChart className="w-3.5 h-3.5" />
                    Barras
                  </button>
                  <button
                    onClick={() => setChartType("line")}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${chartType === "line" ? "bg-violet-600/15 text-violet-400 border border-violet-500/20" : "hover:text-white border border-transparent"}`}
                  >
                    <LineIcon className="w-3.5 h-3.5" />
                    Líneas
                  </button>
                </div>
              )}
            </div>

            {/* Actual Render Viewport */}
            <div className="h-96 w-full flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
                  <span className="text-sm text-zinc-500 font-light">Cargando gráficos...</span>
                </div>
              ) : !selectedChart ? (
                <div className="text-center space-y-2">
                  <BarChart3 className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-sm text-zinc-500">No hay gráficos disponibles. Utiliza el creador de la derecha.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "area" ? (
                    <AreaChart data={selectedChart.metadata.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        {selectedChart.metadata.series.map((s: ChartSeries) => (
                          <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                      <XAxis dataKey={selectedChart.metadata.xAxis} stroke="#52525b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f0f15", borderColor: "#27272a", borderRadius: "12px", color: "#f4f4f5" }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      {selectedChart.metadata.series.map((s: ChartSeries) => (
                        <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fillOpacity={1} fill={`url(#grad-${s.key})`} />
                      ))}
                    </AreaChart>
                  ) : chartType === "bar" ? (
                    <RechartsBarChart data={selectedChart.metadata.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                      <XAxis dataKey={selectedChart.metadata.xAxis} stroke="#52525b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f0f15", borderColor: "#27272a", borderRadius: "12px", color: "#f4f4f5" }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      {selectedChart.metadata.series.map((s: ChartSeries) => (
                        <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
                      ))}
                    </RechartsBarChart>
                  ) : (
                    <RechartsLineChart data={selectedChart.metadata.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                      <XAxis dataKey={selectedChart.metadata.xAxis} stroke="#52525b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f0f15", borderColor: "#27272a", borderRadius: "12px", color: "#f4f4f5" }} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      {selectedChart.metadata.series.map((s: ChartSeries) => (
                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={3} dot={{ r: 4, strokeWidth: 1 }} activeDot={{ r: 6 }} />
                      ))}
                    </RechartsLineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* LIST OF STORED CHARTS */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Visualizaciones de Datos Almacenadas</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {charts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedChart(c)}
                  className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between gap-4 transition-all ${selectedChart?.id === c.id ? "bg-violet-600/10 border-violet-500/40" : "bg-zinc-900/30 border-zinc-900/80 hover:border-zinc-800"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex-shrink-0">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{c.title}</div>
                      <div className="text-[10px] text-zinc-500 truncate mt-0.5">{c.metadata.data.length} puntos de datos</div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChart(c.id);
                    }}
                    className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/20 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DATASET GENERATOR / CUSTOM FORM */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet-400" />
            <h3 className="text-base font-bold text-white">Generar Gráfico</h3>
          </div>

          <form onSubmit={handleCreateChart} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Título del Gráfico</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Conversión Ventas Q2"
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ej. Métricas comparativas trimestrales..."
                className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-violet-500 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none text-xs min-h-[50px] max-h-[100px]"
              />
            </div>

            {/* Config labels */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Serie 1 (Eje Y1)</label>
                <input
                  type="text"
                  required
                  value={label1}
                  onChange={(e) => setLabel1(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-zinc-300 text-[11px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Serie 2 (Eje Y2)</label>
                <input
                  type="text"
                  required
                  value={label2}
                  onChange={(e) => setLabel2(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-zinc-300 text-[11px]"
                />
              </div>
            </div>

            {/* Config Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Color Serie 1</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color1}
                    onChange={(e) => setColor1(e.target.value)}
                    className="w-7 h-7 rounded border-none bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-zinc-500">{color1}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Color Serie 2</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color2}
                    onChange={(e) => setColor2(e.target.value)}
                    className="w-7 h-7 rounded border-none bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-zinc-500">{color2}</span>
                </div>
              </div>
            </div>

            {/* Field list inputs */}
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Dataset de Puntos</label>
                <button
                  type="button"
                  onClick={handleAddField}
                  className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 focus:outline-none"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir Punto
                </button>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {formFields.map((field, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Label"
                      value={field.label}
                      onChange={(e) => handleFieldChange(index, "label", e.target.value)}
                      className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300 text-xs text-center"
                    />
                    <input
                      type="number"
                      required
                      placeholder={label1}
                      value={field.val1 === 0 ? "" : field.val1}
                      onChange={(e) => handleFieldChange(index, "val1", Number(e.target.value))}
                      className="flex-grow w-14 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300 text-xs text-center"
                    />
                    <input
                      type="number"
                      required
                      placeholder={label2}
                      value={field.val2 === 0 ? "" : field.val2}
                      onChange={(e) => handleFieldChange(index, "val2", Number(e.target.value))}
                      className="flex-grow w-14 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-300 text-xs text-center"
                    />
                    <button
                      type="button"
                      disabled={formFields.length <= 2}
                      onClick={() => handleRemoveField(index)}
                      className="p-1 text-zinc-600 hover:text-rose-400 disabled:opacity-30 focus:outline-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 px-4 font-bold text-xs text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {formLoading ? "Generando..." : "Generar Gráfico Interactivo"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
