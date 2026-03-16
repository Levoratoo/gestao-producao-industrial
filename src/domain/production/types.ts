export type SectorKey = "corte" | "costura" | "acabamento" | "expedicao";
export type WorkflowStageKey =
  | "desenho_tecnico"
  | "corte"
  | "estamparia"
  | "qualidade"
  | "expedicao"
  | "faturamento"
  | "embarque";
export type SimulationSpeedKey = "slow" | "normal" | "fast";
export type DemoScenarioKey =
  | "turno_estavel"
  | "gargalo_costura"
  | "parada_critica";

export type SectorStatus = "operando" | "atencao" | "parado" | "setup";
export type WorkflowStageStatus =
  | "aguardando"
  | "em_andamento"
  | "bloqueada"
  | "pronta"
  | "concluida";
export type WorkflowLane =
  | "engenharia"
  | "producao"
  | "qualidade"
  | "logistica"
  | "financeiro";

export type OrderStatus =
  | "em_andamento"
  | "atrasada"
  | "concluida"
  | "parada";

export type AlertSeverity = "info" | "medium" | "high";
export type AlertSource = "simulation" | "manual";
export type MachineStatus = "operando" | "ajuste" | "parada" | "standby";
export type LineStatus = "operando" | "atencao" | "parada";

export type AlertType =
  | "maquina_parada"
  | "op_atrasada"
  | "eficiencia_baixa"
  | "retrabalho"
  | "suprimento";

export type ManualEntryAction =
  | "iniciar_op"
  | "apontar_producao"
  | "registrar_parada"
  | "registrar_defeito"
  | "finalizar_etapa";

export type ManualQualityCategory = "defeito" | "retrabalho";
export type WorkflowDocumentStatus =
  | "pendente"
  | "em_revisao"
  | "liberado"
  | "emitido";
export type RouteHealth = "on_track" | "warning" | "critical";
export type ShipmentStatus =
  | "aguardando_minuta"
  | "pronto_para_faturar"
  | "faturado"
  | "em_carregamento"
  | "despachado";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  standardMinuteValue: number;
  averageUnitsPerHour: number;
}

export interface Operator {
  id: string;
  name: string;
  sector: SectorKey;
  shift: string;
  efficiencyScore: number;
  role: string;
  lineId: string;
  badge: string;
  experienceYears: number;
}

export interface ProductionSector {
  key: SectorKey;
  name: string;
  plannedDailyOutput: number;
  actualDailyOutput: number;
  efficiency: number;
  status: SectorStatus;
  activeOrders: number;
  operators: number;
  machinesRunning: number;
  machinesTotal: number;
  downtimeMinutes: number;
  defects: number;
  alertCount: number;
}

export interface ProductionOrder {
  id: string;
  number: string;
  productId: string;
  productName: string;
  customerName?: string;
  lineId: string;
  plannedQuantity: number;
  producedQuantity: number;
  currentSector: SectorKey;
  dueDate: string;
  status: OrderStatus;
  priority: "alta" | "media" | "baixa";
  line: string;
  defectRate: number;
  lastUpdate: string;
}

export interface ProductionAlert {
  id: string;
  fingerprint: string;
  type: AlertType;
  title: string;
  description: string;
  severity: AlertSeverity;
  sector: SectorKey | "fabrica";
  orderNumber?: string;
  timestamp: string;
  active: boolean;
  source: AlertSource;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

export interface HourlyProductionPoint {
  label: string;
  produced: number;
  target: number;
}

export interface ProductionLine {
  id: string;
  name: string;
  sector: SectorKey;
  supervisorId: string;
  operatorIds: string[];
  targetPerHour: number;
  taktTimeSeconds: number;
  color: string;
}

export interface ProductionMachine {
  id: string;
  code: string;
  name: string;
  sector: SectorKey;
  lineId: string;
  machineType: string;
  serialNumber: string;
  nominalEfficiency: number;
  runtimeTodayMinutes: number;
  maintenanceWindow: string;
}

export interface ProductionManualEntry {
  id: string;
  timestamp: string;
  action: ManualEntryAction;
  orderId: string;
  orderNumber: string;
  productName: string;
  sector: SectorKey;
  operatorId: string;
  operatorName: string;
  quantity?: number;
  durationMinutes?: number;
  qualityCategory?: ManualQualityCategory;
  reason?: string;
  note?: string;
}

export interface WorkflowDocument {
  id: string;
  label: string;
  status: WorkflowDocumentStatus;
  owner: string;
  reference?: string;
  updatedAt: string;
}

export interface OrderWorkflowStage {
  key: WorkflowStageKey;
  label: string;
  lane: WorkflowLane;
  status: WorkflowStageStatus;
  progress: number;
  ownerTeam: string;
  leadTimeHours: number;
  slaHours: number;
  queueUnits: number;
  completedUnits: number;
  updatedAt: string;
  note: string;
  blockers: string[];
  documents: WorkflowDocument[];
}

export interface OrderProcessFlow {
  orderId: string;
  orderNumber: string;
  productName: string;
  customerName: string;
  priority: ProductionOrder["priority"];
  plannedQuantity: number;
  deliveredQuantity: number;
  dueDate: string;
  currentStage: WorkflowStageKey;
  currentStageLabel: string;
  overallCompletion: number;
  routeHealth: RouteHealth;
  blockers: string[];
  stages: OrderWorkflowStage[];
  invoiceNumber?: string;
  manifestNumber?: string;
  truckPlate?: string;
  loadingDock?: string;
  expectedDispatchAt?: string;
}

export interface ProcessStageOverview {
  key: WorkflowStageKey;
  label: string;
  shortLabel: string;
  lane: WorkflowLane;
  ownerTeam: string;
  status: WorkflowStageStatus;
  activeOrders: number;
  queuedOrders: number;
  backlogUnits: number;
  completedUnits: number;
  efficiency: number;
  leadTimeHours: number;
  slaHours: number;
  alertCount: number;
  pendingDocuments: number;
  bottleneckSummary: string;
  nextStage?: WorkflowStageKey;
}

export interface ShipmentManifest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  invoiceNumber?: string;
  manifestNumber?: string;
  truckPlate?: string;
  carrierName: string;
  driverName: string;
  dock: string;
  status: ShipmentStatus;
  expectedDepartureAt: string;
  updatedAt: string;
  packages: number;
  weightKg: number;
}

export interface StartOrderPayload {
  orderId: string;
  operatorId: string;
  note?: string;
}

export interface ReportProductionPayload {
  orderId: string;
  operatorId: string;
  quantity: number;
  note?: string;
}

export interface RegisterDowntimePayload {
  orderId: string;
  operatorId: string;
  durationMinutes: number;
  reason: string;
  note?: string;
}

export interface RegisterQualityPayload {
  orderId: string;
  operatorId: string;
  quantity: number;
  category: ManualQualityCategory;
  reason: string;
  note?: string;
}

export interface FinalizeStagePayload {
  orderId: string;
  operatorId: string;
  note?: string;
}

export interface ProductionSnapshot {
  tick: number;
  scenarioKey: DemoScenarioKey;
  currentTime: string;
  shiftLabel: string;
  connectedOperators: number;
  productMix: number;
  dailyTarget: number;
  dailyProduced: number;
  projectedCompletion: number;
  defectRate: number;
  downtimeMinutes: number;
  orders: ProductionOrder[];
  sectors: ProductionSector[];
  alerts: ProductionAlert[];
  alertHistory: ProductionAlert[];
  products: Product[];
  operators: Operator[];
  lines: ProductionLine[];
  machines: ProductionMachine[];
  hourlyProduction: HourlyProductionPoint[];
  manualEntries: ProductionManualEntry[];
  processStages: ProcessStageOverview[];
  orderFlows: OrderProcessFlow[];
  shipmentManifests: ShipmentManifest[];
}

export interface ProductionScenarioPreset {
  key: DemoScenarioKey;
  label: string;
  shortLabel: string;
  description: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
}
