"""
Task Optimization Router - AI-powered task scheduling and route optimization
"""
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request
import structlog

from services.openai_service import OpenAIService

logger = structlog.get_logger()
router = APIRouter()

openai_service = OpenAIService()


class RoomTask(BaseModel):
    room_number: str
    floor: int = Field(ge=1, le=20)
    task_type: str = Field(description="cleaning, inspection, maintenance, complaint")
    priority: str = Field(default="medium")
    estimated_minutes: int = Field(default=15)


class OptimizeRouteRequest(BaseModel):
    rooms: list[RoomTask] = Field(..., min_length=1)
    staff_location: str = Field(default="Reception")
    max_hours: float = Field(default=8.0)


class ScheduleRequest(BaseModel):
    tasks: list[dict] = Field(..., min_length=1)
    staff_count: int = Field(ge=1, le=50)
    shift_hours: float = Field(default=8.0)


@router.post("/optimize-route")
async def optimize_route(body: OptimizeRouteRequest):
    """Optimize cleaning/task route for a staff member."""
    rooms = [r.model_dump() for r in body.rooms]

    # Sort by floor then priority for basic optimization
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    # Group by floor
    floors = {}
    for room in rooms:
        floor = room["floor"]
        floors.setdefault(floor, []).append(room)

    # Sort within each floor by priority
    optimized = []
    for floor_num in sorted(floors.keys()):
        floor_rooms = sorted(
            floors[floor_num],
            key=lambda r: (priority_order.get(r["priority"], 2), r["room_number"])
        )
        optimized.extend(floor_rooms)

    # Calculate ETAs
    total_minutes = 0
    for i, room in enumerate(optimized):
        room["order"] = i + 1
        room["start_minute"] = total_minutes
        # Add travel time between floors
        if i > 0 and room["floor"] != optimized[i - 1]["floor"]:
            total_minutes += 5  # Floor transition time
        total_minutes += room["estimated_minutes"]
        room["end_minute"] = total_minutes

    # Try GPT optimization
    gpt_result = await openai_service.optimize_task_route(rooms, body.staff_location)

    result = {
        "optimized_route": optimized,
        "total_estimated_minutes": total_minutes,
        "total_rooms": len(optimized),
        "floors_covered": len(floors),
        "efficiency_tips": [
            "Start from the top floor and work down to minimize travel",
            "Handle critical tasks first on each floor",
            "Group similar task types when possible",
            f"Estimated completion: {total_minutes // 60}h {total_minutes % 60}m",
        ],
    }

    if gpt_result:
        result["gpt_optimization"] = gpt_result

    return {"data": result}


@router.post("/schedule")
async def generate_schedule(body: ScheduleRequest):
    """Generate optimized staff schedule for tasks."""
    tasks = body.tasks
    staff_count = body.staff_count
    shift_minutes = int(body.shift_hours * 60)

    # Distribute tasks across staff
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_tasks = sorted(tasks, key=lambda t: priority_order.get(t.get("priority", "medium"), 2))

    # Round-robin assignment with priority consideration
    staff_schedules = [{"staff_index": i, "tasks": [], "total_minutes": 0} for i in range(staff_count)]

    for task in sorted_tasks:
        # Find staff with least load
        lightest = min(staff_schedules, key=lambda s: s["total_minutes"])
        task_minutes = task.get("estimated_minutes", 15)

        if lightest["total_minutes"] + task_minutes <= shift_minutes:
            lightest["tasks"].append(task)
            lightest["total_minutes"] += task_minutes

    return {
        "data": {
            "schedules": staff_schedules,
            "total_tasks": len(tasks),
            "assigned_tasks": sum(len(s["tasks"]) for s in staff_schedules),
            "unassigned_tasks": len(tasks) - sum(len(s["tasks"]) for s in staff_schedules),
            "staff_utilization": [
                {
                    "staff_index": s["staff_index"],
                    "utilization_percent": round((s["total_minutes"] / shift_minutes) * 100, 1),
                    "tasks_count": len(s["tasks"]),
                }
                for s in staff_schedules
            ],
        }
    }
