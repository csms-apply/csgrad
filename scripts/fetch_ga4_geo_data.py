#!/usr/bin/env python3
"""Fetch geographic visitor data from Google Analytics 4 and write to static/data/visitor-geo.json."""

import json
import os
import sys
from datetime import datetime, timezone

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)


def main():
    property_id = os.environ.get("GA_PROPERTY_ID")
    credentials_json = os.environ.get("GA_CREDENTIALS_JSON")

    if not property_id or not credentials_json:
        print("Error: GA_PROPERTY_ID and GA_CREDENTIALS_JSON env vars are required", file=sys.stderr)
        sys.exit(1)

    # Write credentials to a temp file for the client
    creds_path = "/tmp/ga_credentials.json"
    with open(creds_path, "w") as f:
        f.write(credentials_json)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path

    client = BetaAnalyticsDataClient()

    # Fetch country-level data
    country_request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="country"), Dimension(name="countryId")],
        metrics=[Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="365daysAgo", end_date="today")],
    )
    country_response = client.run_report(country_request)

    countries = {}
    for row in country_response.rows:
        country_name = row.dimension_values[0].value
        country_code = row.dimension_values[1].value  # ISO alpha-2
        users = int(row.metric_values[0].value)
        if country_code and country_code != "(not set)":
            countries[country_code] = users

    # Fetch region-level data
    region_request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="region")],
        metrics=[Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="365daysAgo", end_date="today")],
    )
    region_response = client.run_report(region_request)

    regions = {}
    for row in region_response.rows:
        region_name = row.dimension_values[0].value
        users = int(row.metric_values[0].value)
        if region_name and region_name != "(not set)":
            regions[region_name] = users

    output = {
        "lastUpdated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "countries": countries,
        "regions": regions,
    }

    output_path = os.path.join(os.path.dirname(__file__), "..", "static", "data", "visitor-geo.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Written {len(countries)} countries and {len(regions)} regions to {output_path}")

    # Clean up credentials
    os.remove(creds_path)


if __name__ == "__main__":
    main()
