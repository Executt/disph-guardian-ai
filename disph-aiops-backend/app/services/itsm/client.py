"""
ITSM Client – Integração real com GLPI, Jira, ServiceNow e CITSmart.
"""

import httpx
import structlog
from typing import Optional
from app.config import get_settings

logger = structlog.get_logger(__name__)


class GLPIClient:
    """Cliente REST API para GLPI 10.x."""

    def __init__(self):
        s = get_settings()
        self.base_url = s.GLPI_BASE_URL.rstrip("/")
        self.api_token = s.GLPI_API_TOKEN
        self._session_token: Optional[str] = None

    async def _init_session(self, client: httpx.AsyncClient) -> str:
        resp = await client.get(
            f"{self.base_url}/apirest.php/initSession",
            headers={
                "Authorization": f"user_token {self.api_token}",
                "App-Token": self.api_token,
            },
        )
        resp.raise_for_status()
        self._session_token = resp.json()["session_token"]
        return self._session_token

    async def create_ticket(
        self,
        title: str,
        description: str,
        category: str,
        priority: int = 3,
        assigned_group: Optional[str] = None,
    ) -> dict:
        if not self.base_url or not self.api_token:
            return {"status": "skipped", "reason": "glpi_not_configured"}

        async with httpx.AsyncClient(timeout=20.0) as client:
            session = await self._init_session(client)
            headers = {
                "Session-Token": session,
                "App-Token": self.api_token,
                "Content-Type": "application/json",
            }

            payload = {
                "input": {
                    "name": title,
                    "content": description,
                    "priority": priority,
                    "type": 1,  # Incidente
                    "itilcategories_id": category,
                }
            }
            if assigned_group:
                payload["input"]["_groups_id_assign"] = assigned_group

            resp = await client.post(
                f"{self.base_url}/apirest.php/Ticket",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

            ticket_id = data.get("id", "unknown")
            logger.info("glpi_ticket_created", ticket_id=ticket_id)
            return {
                "status": "created",
                "ticket_id": str(ticket_id),
                "url": f"{self.base_url}/front/ticket.form.php?id={ticket_id}",
            }


class JiraClient:
    """Cliente REST API para Jira Cloud / Data Center."""

    def __init__(self):
        s = get_settings()
        self.base_url = s.JIRA_BASE_URL.rstrip("/")
        self.api_token = s.JIRA_API_TOKEN

    async def create_issue(
        self,
        project_key: str,
        summary: str,
        description: str,
        issue_type: str = "Bug",
        priority: str = "High",
        labels: Optional[list[str]] = None,
    ) -> dict:
        if not self.base_url or not self.api_token:
            return {"status": "skipped", "reason": "jira_not_configured"}

        payload = {
            "fields": {
                "project": {"key": project_key},
                "summary": summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description}],
                        }
                    ],
                },
                "issuetype": {"name": issue_type},
                "priority": {"name": priority},
            }
        }
        if labels:
            payload["fields"]["labels"] = labels

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/rest/api/3/issue",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            logger.info("jira_issue_created", key=data.get("key"))
            return {
                "status": "created",
                "ticket_id": data.get("key"),
                "url": f"{self.base_url}/browse/{data.get('key')}",
            }


class ServiceNowClient:
    """Cliente REST API para ServiceNow Table API."""

    def __init__(self):
        s = get_settings()
        self.base_url = s.SERVICENOW_BASE_URL.rstrip("/")
        self.api_token = s.SERVICENOW_API_TOKEN

    async def create_incident(
        self,
        short_description: str,
        description: str,
        urgency: int = 2,
        impact: int = 2,
        assignment_group: Optional[str] = None,
    ) -> dict:
        if not self.base_url or not self.api_token:
            return {"status": "skipped", "reason": "servicenow_not_configured"}

        payload = {
            "short_description": short_description,
            "description": description,
            "urgency": str(urgency),
            "impact": str(impact),
        }
        if assignment_group:
            payload["assignment_group"] = assignment_group

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/now/table/incident",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.api_token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json().get("result", {})

            logger.info("servicenow_incident_created", number=data.get("number"))
            return {
                "status": "created",
                "incident_number": data.get("number"),
                "sys_id": data.get("sys_id"),
                "url": f"{self.base_url}/nav_to.do?uri=incident.do?sys_id={data.get('sys_id')}",
            }


class CITSmartClient:
    """Cliente REST API para CITSmart/ITSM."""

    def __init__(self):
        s = get_settings()
        self.base_url = s.CITSMART_BASE_URL.rstrip("/")
        self.api_token = s.CITSMART_API_TOKEN

    async def create_request(
        self,
        service_id: int,
        description: str,
        requester: str,
        urgency: str = "Medium",
    ) -> dict:
        if not self.base_url or not self.api_token:
            return {"status": "skipped", "reason": "citsmart_not_configured"}

        payload = {
            "sessionID": self.api_token,
            "synchronize": True,
            "sourceRequest": {
                "userID": requester,
                "type": "R",
                "description": description,
                "service": service_id,
                "urgency": urgency,
            },
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/citsmart/services/request/create",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

            ticket_id = data.get("number", "unknown")
            logger.info("citsmart_request_created", ticket_id=ticket_id)
            return {
                "status": "created",
                "ticket_id": str(ticket_id),
            }
