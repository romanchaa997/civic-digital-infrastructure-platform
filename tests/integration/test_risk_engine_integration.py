#!/usr/bin/env python3
"""
Risk Engine + MFO Risk API Integration Test
Agent C + Agent D Integration: Risk Assessment Pipeline

Test the full MVP pipeline:
Demo Data (seeds_demo.py output) → Risk Engine (Audityzer) → Risk API (MFO-Shield)
"""

import requests
import json
from typing import Dict, Any, List
from dataclasses import dataclass
from datetime import datetime

# Constants
RISK_API_BASE_URL = "http://localhost:5000"
RISK_ENGINE_MOCK_DATA = {
    "company_001": {
        "overdue_payments": 25,
        "loan_defaults": 15,
        "compliance_violations": 10,
        "regulatory_flags": 5
    },
    "company_002": {
        "overdue_payments": 50,
        "loan_defaults": 40,
        "compliance_violations": 30,
        "regulatory_flags": 20
    },
    "company_003": {
        "overdue_payments": 80,
        "loan_defaults": 75,
        "compliance_violations": 70,
        "regulatory_flags": 65
    }
}


class RiskAssessmentResult:
    """Result of risk assessment from the pipeline"""
    
    def __init__(self, subject_id: str, response: Dict[str, Any]):
        self.subject_id = subject_id
        self.assessment_id = response.get('assessment_id')
        self.risk_score = response.get('risk_score')
        self.risk_level = response.get('risk_level')
        self.timestamp = response.get('timestamp')
        self.details = response.get('details', {})
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'subject_id': self.subject_id,
            'assessment_id': self.assessment_id,
            'risk_score': self.risk_score,
            'risk_level': self.risk_level,
            'timestamp': self.timestamp,
            'details': self.details
        }


class IntegrationTester:
    """Test the Risk Engine + Risk API integration"""
    
    def __init__(self, api_base_url: str):
        self.api_url = api_base_url
        self.results: List[RiskAssessmentResult] = []
        self.errors: List[Dict[str, Any]] = []
    
    def test_health_check(self) -> bool:
        """Test that the Risk API is healthy"""
        print("\n[TEST] Health Check")
        print(f"  Endpoint: GET {self.api_url}/health")
        try:
            response = requests.get(f"{self.api_url}/health", timeout=5)
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.json()}")
            return response.status_code == 200
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            self.errors.append({
                'test': 'health_check',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
            return False
    
    def test_risk_assessment(self, subject_id: str, subject_data: Dict[str, Any]) -> bool:
        """Test risk assessment for a subject"""
        print(f"\n[TEST] Risk Assessment: {subject_id}")
        print(f"  Input Data: {subject_data}")
        try:
            response = requests.post(
                f"{self.api_url}/subjects/{subject_id}/risk",
                json=subject_data,
                timeout=5
            )
            print(f"  Status: {response.status_code}")
            result = response.json()
            print(f"  Risk Score: {result.get('risk_score')}")
            print(f"  Risk Level: {result.get('risk_level')}")
            
            if response.status_code == 200:
                self.results.append(RiskAssessmentResult(subject_id, result))
                return True
            else:
                self.errors.append({
                    'test': f'risk_assessment_{subject_id}',
                    'error': result.get('error', 'Unknown error'),
                    'status_code': response.status_code
                })
                return False
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            self.errors.append({
                'test': f'risk_assessment_{subject_id}',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
            return False
    
    def run_full_pipeline_test(self) -> Dict[str, Any]:
        """Run the full MVP pipeline test"""
        print("\n" + "="*60)
        print("RISK ENGINE + MFO RISK API INTEGRATION TEST")
        print(f"Start Time: {datetime.utcnow().isoformat()}")
        print("="*60)
        
        # Test 1: Health check
        health_ok = self.test_health_check()
        if not health_ok:
            print("\n[FATAL] Risk API is not responding. Cannot proceed with tests.")
            return self._generate_report()
        
        # Test 2: Risk assessments for each company
        passed_tests = 0
        for company_id, company_data in RISK_ENGINE_MOCK_DATA.items():
            if self.test_risk_assessment(company_id, company_data):
                passed_tests += 1
        
        print(f"\n[SUMMARY] Passed {passed_tests}/{len(RISK_ENGINE_MOCK_DATA)} risk assessments")
        
        return self._generate_report()
    
    def _generate_report(self) -> Dict[str, Any]:
        """Generate integration test report"""
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'test_name': 'Risk Engine + MFO Risk API Integration',
            'total_tests': len(RISK_ENGINE_MOCK_DATA) + 1,  # +1 for health check
            'passed': len(self.results) + (1 if not self.errors else 0),
            'failed': len(self.errors),
            'results': [r.to_dict() for r in self.results],
            'errors': self.errors,
            'pipeline_status': 'READY' if len(self.errors) == 0 else 'DEGRADED'
        }
        return report
    
    def print_report(self, report: Dict[str, Any]):
        """Print the integration test report"""
        print("\n" + "="*60)
        print("INTEGRATION TEST REPORT")
        print("="*60)
        print(f"Timestamp: {report['timestamp']}")
        print(f"Test Name: {report['test_name']}")
        print(f"Total Tests: {report['total_tests']}")
        print(f"Passed: {report['passed']}")
        print(f"Failed: {report['failed']}")
        print(f"Pipeline Status: {report['pipeline_status']}")
        
        if report['results']:
            print("\n[RESULTS]")
            for result in report['results']:
                print(f"  {result['subject_id']}: Risk Score = {result['risk_score']}, Level = {result['risk_level']}")
        
        if report['errors']:
            print("\n[ERRORS]")
            for error in report['errors']:
                print(f"  {error['test']}: {error.get('error', 'Unknown')}")
        
        print("\n" + "="*60)
        print("JSON Report:")
        print(json.dumps(report, indent=2))
        print("="*60)


if __name__ == "__main__":
    print("\nInitializing Risk Engine + MFO Risk API Integration Test...")
    print(f"Target API: {RISK_API_BASE_URL}")
    
    tester = IntegrationTester(RISK_API_BASE_URL)
    report = tester.run_full_pipeline_test()
    tester.print_report(report)
    
    # Exit with appropriate code
    exit(0 if report['pipeline_status'] == 'READY' else 1)
