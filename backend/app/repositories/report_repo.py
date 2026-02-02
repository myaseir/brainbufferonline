from app.db.mongodb import db
from datetime import datetime, timezone

class ReportRepository:
    async def create_report(self, report_data: dict):
        report_data["created_at"] = datetime.now(timezone.utc)
        report_data["status"] = "open"
        # Remember to use .db.db based on your previous error!
        result = await db.db.reports.insert_one(report_data)
        return str(result.inserted_id)

    # 👇 ADD THIS NEW METHOD 👇
    async def get_all_reports(self):
        """Fetches latest 100 reports, sorted by newest first"""
        reports = await db.db.reports.find().sort("created_at", -1).to_list(length=100)
        
        # Convert ObjectId to string for JSON compatibility
        for r in reports:
            r["_id"] = str(r["_id"])
        return reports