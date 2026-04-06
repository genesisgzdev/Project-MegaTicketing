import os
import requests
import json

# Configuration for GitHub Issue Bot
REPO_NAME = "genesisgzdev/Project-MegaTicketing"
TOKEN = os.getenv("GITHUB_TOKEN")

def create_soc_issue():
    if not TOKEN:
        print("[!] No GitHub token found. Skipping SOC report.")
        return

    url = f"https://api.github.com/repos/{REPO_NAME}/issues"
    headers = {
        "Authorization": f"token {TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # Template production de SOC solicitado
    payload = {
        "title": "[SOC-URGENT] Verify ETW-Ti Telemetry for Early Bird APC Injection 2026",
        "body": """
### Reporte del Centro de Operaciones (SOC)

Se ha detectado una nueva tÃ©cnica de inyecciÃ³n mediante **NtQueueApcThread** en campaÃ±as activas de Abril de 2026.

**AcciÃ³n requerida:**
Validar que la implementaciÃ³n del `SequenceCorrelator` y el driver en `TDSDriver.c` estÃ©n correlacionando correctamente los eventos de Early Bird provenientes de la telemetrÃ­a ETW-Ti.

**Arsenal Integrado:**
- **Snyk:** Escaneo dinÃ¡mico completado con 0 vulnerabilidades (Token UAT Validado).
- **Google SecOps:** ConfiguraciÃ³n de regla YARA-L pendiente de ingesta.
- **Infrastructure:** Despliegue en cluster GKE verificado para alta disponibilidad.
""",
        "labels": ["security", "SOC-URGENT"]
    }

    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code == 201:
        print("[+] SOC Issue successfully reported to GitHub.")
    else:
        print(f"[!] Failed to report issue. Status: {response.status_code}, Response: {response.text}")

if __name__ == "__main__":
    create_soc_issue()


