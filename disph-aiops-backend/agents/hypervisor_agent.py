"""On-prem hypervisor collector agent.

Loop a cada 60s: coleta métricas de vSphere e Hyper-V e envia ao edge
function `hypervisor-ingest` via x-agent-token.

Configuração via variáveis de ambiente:
  SUPABASE_FUNCTIONS_URL   ex.: https://<proj>.functions.supabase.co
  HYPERVISOR_AGENT_TOKEN   shared secret (igual ao do projeto Lovable Cloud)
  VSPHERE_HOST, VSPHERE_USER, VSPHERE_PASS  (opcional)
  HYPERV_HOSTS=hv01,hv02   (opcional, lista CSV de hosts)
  HYPERV_USER, HYPERV_PASS (opcional, para WinRM)
  ENVIRONMENT_ID           (UUID em monitored_environments, opcional)

Dependências opcionais: pyVmomi (vSphere), pywinrm (Hyper-V).
Sem essas libs, o coletor envia apenas os hosts que conseguir.
"""
from __future__ import annotations
import os, time, json, socket, urllib.request, ssl, traceback
from typing import Any

INGEST_URL = (os.getenv("SUPABASE_FUNCTIONS_URL", "").rstrip("/") + "/hypervisor-ingest")
TOKEN = os.getenv("HYPERVISOR_AGENT_TOKEN", "")
ENV_ID = os.getenv("ENVIRONMENT_ID") or None
INTERVAL = int(os.getenv("INTERVAL_SECONDS", "60"))
AGENT_NAME = os.getenv("AGENT_NAME", f"agent-{socket.gethostname()}")
AGENT_VERSION = os.getenv("AGENT_VERSION", "1.6.0")
HOSTNAME = socket.gethostname()


def collect_vsphere() -> tuple[list[dict], list[dict], list[dict]]:
    host = os.getenv("VSPHERE_HOST")
    user = os.getenv("VSPHERE_USER")
    pwd = os.getenv("VSPHERE_PASS")
    if not (host and user and pwd):
        return [], [], []
    try:
        from pyVim.connect import SmartConnect, Disconnect  # type: ignore
        from pyVmomi import vim  # type: ignore
    except ImportError:
        print("[vsphere] pyVmomi não instalado; pulando")
        return [], [], []

    ctx = ssl._create_unverified_context()
    si = SmartConnect(host=host, user=user, pwd=pwd, sslContext=ctx)
    try:
        content = si.RetrieveContent()
        hosts_out: list[dict] = []
        vms_out: list[dict] = []
        for dc in content.rootFolder.childEntity:
            for cluster in getattr(dc.hostFolder, "childEntity", []):
                for h in getattr(cluster, "host", []):
                    summary = h.summary
                    qs = summary.quickStats
                    total_cpu = max(1, summary.hardware.cpuMhz * summary.hardware.numCpuCores)
                    total_mem = max(1, summary.hardware.memorySize // (1024 * 1024))
                    cpu_pct = round((qs.overallCpuUsage or 0) * 100 / total_cpu, 1)
                    ram_pct = round((qs.overallMemoryUsage or 0) * 100 / total_mem, 1)
                    status = "ok"
                    if cpu_pct > 85 or ram_pct > 85: status = "warn"
                    if cpu_pct > 95 or ram_pct > 95: status = "crit"
                    hosts_out.append({
                        "platform": "vmware",
                        "hostname": summary.config.name,
                        "cluster": getattr(cluster, "name", None),
                        "cpu_pct": cpu_pct, "ram_pct": ram_pct,
                        "datastore_pct": 0,
                        "uptime_seconds": qs.uptime or 0,
                        "status": status,
                        "environment_id": ENV_ID,
                    })
                    for vm in getattr(h, "vm", []):
                        try:
                            vqs = vm.summary.quickStats
                            if (vqs.overallCpuReadiness or 0) > 12:
                                vms_out.append({
                                    "hostname": summary.config.name,
                                    "name": vm.summary.config.name,
                                    "symptom": f"CPU Ready {vqs.overallCpuReadiness}%",
                                    "severity": "warn",
                                    "recommendation": "Considerar vMotion para host com menor contenção",
                                })
                        except Exception:
                            continue
        return hosts_out, vms_out, []
    finally:
        Disconnect(si)


def collect_hyperv() -> tuple[list[dict], list[dict], list[dict]]:
    hosts_csv = os.getenv("HYPERV_HOSTS")
    user = os.getenv("HYPERV_USER")
    pwd = os.getenv("HYPERV_PASS")
    if not (hosts_csv and user and pwd):
        return [], [], []
    try:
        import winrm  # type: ignore
    except ImportError:
        print("[hyperv] pywinrm não instalado; pulando")
        return [], [], []

    hosts_out: list[dict] = []
    for host in [h.strip() for h in hosts_csv.split(",") if h.strip()]:
        try:
            s = winrm.Session(host, auth=(user, pwd), transport="ntlm")
            ps = (
                "$os = Get-CimInstance Win32_OperatingSystem;"
                "$cpu = (Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue;"
                "$mem = 100 - (($os.FreePhysicalMemory / $os.TotalVisibleMemorySize) * 100);"
                "ConvertTo-Json @{cpu=$cpu; mem=$mem; uptime=((Get-Date)-$os.LastBootUpTime).TotalSeconds}"
            )
            r = s.run_ps(ps)
            data = json.loads(r.std_out.decode())
            cpu_pct = round(float(data.get("cpu", 0)), 1)
            ram_pct = round(float(data.get("mem", 0)), 1)
            status = "warn" if cpu_pct > 85 or ram_pct > 85 else "ok"
            hosts_out.append({
                "platform": "hyperv", "hostname": host,
                "cpu_pct": cpu_pct, "ram_pct": ram_pct, "datastore_pct": 0,
                "uptime_seconds": int(float(data.get("uptime", 0))),
                "status": status, "environment_id": ENV_ID,
            })
        except Exception as e:
            print(f"[hyperv:{host}] erro: {e}")
    return hosts_out, [], []


def post_ingest(payload: dict[str, Any]) -> None:
    if not (INGEST_URL and TOKEN):
        print("SUPABASE_FUNCTIONS_URL / HYPERVISOR_AGENT_TOKEN ausentes")
        return
    req = urllib.request.Request(
        INGEST_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "x-agent-token": TOKEN},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(f"ingest -> {resp.status} {resp.read().decode()[:200]}")


def tick() -> None:
    logs: list[dict] = []
    started = time.time()

    def log(level: str, platform: str, message: str, details: dict | None = None):
        logs.append({
            "agent_name": AGENT_NAME, "platform": platform,
            "environment_id": ENV_ID, "level": level,
            "message": message, "details": details,
        })

    log("info", "vsphere", "ciclo iniciado")
    try:
        vh, vv, vf = collect_vsphere()
    except Exception as e:
        log("error", "vsphere", f"falha coleta vSphere: {e}")
        vh, vv, vf = [], [], []
    try:
        hh, hv, hf = collect_hyperv()
    except Exception as e:
        log("error", "hyperv", f"falha coleta Hyper-V: {e}")
        hh, hv, hf = [], [], []

    elapsed = round(time.time() - started, 2)
    log("info", "vsphere", f"vSphere: {len(vh)} hosts, {len(vv)} VMs em {elapsed}s")
    log("info", "hyperv", f"Hyper-V: {len(hh)} hosts em {elapsed}s")

    payload = {
        "hosts": vh + hh, "vms": vv + hv, "failure_points": vf + hf,
        "logs": logs,
    }

    for platform, has_data in (("vsphere", bool(vh or vv)), ("hyperv", bool(hh))):
        had_error = any(l["level"] == "error" and l["platform"] == platform for l in logs)
        payload["agent"] = {
            "agent_name": AGENT_NAME, "platform": platform,
            "environment_id": ENV_ID, "hostname": HOSTNAME, "version": AGENT_VERSION,
            "status": "degraded" if had_error else ("online" if has_data else "degraded"),
            "last_error_message": next((l["message"] for l in logs if l["level"] == "error" and l["platform"] == platform), None),
        }
        post_ingest(payload)
        payload["hosts"], payload["vms"], payload["failure_points"], payload["logs"] = [], [], [], []


if __name__ == "__main__":
    print(f"hypervisor_agent {AGENT_VERSION} iniciando; intervalo={INTERVAL}s ingest={INGEST_URL}")
    while True:
        try:
            tick()
        except Exception:
            traceback.print_exc()
        time.sleep(INTERVAL)
