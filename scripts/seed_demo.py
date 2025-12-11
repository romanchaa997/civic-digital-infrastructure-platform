#!/usr/bin/env python3
"""
Demonstration Data Seeder for Civic Digital Infrastructure Platform
Generates sample data: 5 companies, 20 contracts, 10 incidents
"""

from faker import Faker
import json
import random
from datetime import datetime, timedelta

fake = Faker(['uk_UA', 'en_US'])

def generate_companies(count=5):
    """Generate fake company records"""
    companies = []
    for i in range(count):
        companies.append({
            "id": f"company_{i+1}",
            "name": fake.company(),
            "registration_number": fake.bban(),
            "address": fake.address(),
            "created_at": fake.date_time_this_year().isoformat(),
            "status": random.choice(["active", "pending", "inactive"])
        })
    return companies

def generate_contracts(companies, count=20):
    """Generate fake contract records linked to companies"""
    contracts = []
    for i in range(count):
        company = random.choice(companies)
        contracts.append({
            "id": f"contract_{i+1}",
            "company_id": company["id"],
            "amount_uah": round(random.uniform(50000, 5000000), 2),
            "signing_date": fake.date_this_year().isoformat(),
            "contractor_name": fake.name(),
            "description": fake.sentence(nb_words=8),
            "status": random.choice(["signed", "pending", "completed"])
        })
    return contracts

def generate_incidents(count=10):
    """Generate fake incident reports"""
    incidents = []
    incident_types = ["audit_discrepancy", "fraud_alert", "compliance_violation", "data_breach", "procurement_issue"]
    for i in range(count):
        incidents.append({
            "id": f"incident_{i+1}",
            "type": random.choice(incident_types),
            "description": fake.paragraph(nb_sentences=3),
            "severity": random.choice(["low", "medium", "high", "critical"]),
            "reported_at": fake.date_time_this_month().isoformat(),
            "status": random.choice(["open", "investigating", "resolved"])
        })
    return incidents

def main():
    print("[AGENT-C] Generating demo data for Bakhmach city civic platform...")
    
    companies = generate_companies(5)
    contracts = generate_contracts(companies, 20)
    incidents = generate_incidents(10)
    
    demo_data = {
        "generated_at": datetime.now().isoformat(),
        "entities": {
            "companies": companies,
            "contracts": contracts,
            "incidents": incidents
        },
        "summary": {
            "total_companies": len(companies),
            "total_contracts": len(contracts),
            "total_incidents": len(incidents)
        }
    }
    
    with open("demo_data.json", "w", encoding="utf-8") as f:
        json.dump(demo_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Demo data generated: {len(companies)} companies, {len(contracts)} contracts, {len(incidents)} incidents")
    print(f"📁 Saved to: demo_data.json")

if __name__ == "__main__":
    main()
