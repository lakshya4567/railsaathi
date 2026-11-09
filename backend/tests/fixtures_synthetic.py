"""
SYNTHETIC test data — NOT a real timetable.

Shapes mirror the real MongoDB documents (trains / stations collections) so the
tool logic can be tested offline. Names are prefixed TEST and the times are
invented; nothing here is ever used by the running application.
"""

ALL = dict(SUN=True, MON=True, TUE=True, WED=True, THU=True, FRI=True, SAT=True)


def stop(seq, code, name, arr, dep, day=1, dist=0):
    return {"sequence": seq, "stationCode": code, "stationName": name,
            "arrivalTime": arr, "departureTime": dep, "journeyDay": day, "distance": dist}


STATIONS = [
    {"code": "R", "name": "RAIPUR JN", "state": "Chhattisgarh", "zone": "SECR",
     "address": "Raipur", "coordinates": {"latitude": 21.25, "longitude": 81.63}},
    {"code": "RCTY", "name": "RAIPUR CITY", "state": "Chhattisgarh", "zone": "SECR",
     "address": "", "coordinates": None},
    {"code": "NGP", "name": "NAGPUR", "state": "Maharashtra", "zone": "CR",
     "address": "Nagpur", "coordinates": {"latitude": 21.15, "longitude": 79.08}},
    {"code": "DURG", "name": "DURG JN", "state": "Chhattisgarh", "zone": "SECR",
     "address": "", "coordinates": {"latitude": 21.19, "longitude": 81.28}},
    {"code": "G", "name": "GONDIA JN", "state": "Maharashtra", "zone": "SECR",
     "address": "", "coordinates": {"latitude": 0, "longitude": 0}},  # zero = unknown
    {"code": "BSP", "name": "BILASPUR JN", "state": "Chhattisgarh", "zone": "SECR",
     "address": "", "coordinates": {"latitude": 22.08, "longitude": 82.15}},
    {"code": "HWH", "name": "HOWRAH JN", "state": "West Bengal", "zone": "ER",
     "address": "", "coordinates": {"latitude": 22.58, "longitude": 88.34}},
    {"code": "CSMT", "name": "MUMBAI CSMT", "state": "Maharashtra", "zone": "CR",
     "address": "", "coordinates": {"latitude": 18.94, "longitude": 72.84}},
    {"code": "LONELY", "name": "LONELY HALT", "state": "Chhattisgarh", "zone": "SECR",
     "address": "", "coordinates": None},  # no train stops here
]

TRAINS = [
    {  # long run, 3 calendar days, starts SUN/TUE/FRI
        "trainNumber": "12810", "trainName": "TEST MAIL (SYNTHETIC)", "type": "MAIL",
        "source": {"code": "HWH", "name": "HOWRAH JN"},
        "destination": {"code": "CSMT", "name": "MUMBAI CSMT"},
        "overallDistanceKm": 1900.0,
        "runningDays": {**{d: False for d in ALL}, "SUN": True, "TUE": True, "FRI": True},
        "completeOrderedRoute": [
            stop(1, "HWH", "HOWRAH JN", None, "22:05:00", 1, 0),
            stop(2, "BSP", "BILASPUR JN", "05:10:00", "05:20:00", 2, 800),
            stop(3, "R", "RAIPUR JN", "07:15:00", "07:25:00", 2, 900),
            stop(4, "DURG", "DURG JN", "08:05:00", "08:10:00", 2, 940),
            stop(5, "G", "GONDIA JN", "11:00:00", "11:05:00", 2, 1100),
            stop(6, "NGP", "NAGPUR", "13:10:00", "13:20:00", 2, 1250),
            stop(7, "CSMT", "MUMBAI CSMT", "02:40:00", None, 3, 1900),
        ],
    },
    {  # fast direct R -> NGP
        "trainNumber": "90001", "trainName": "TEST EXPRESS A", "type": "SF",
        "source": {"code": "R", "name": "RAIPUR JN"},
        "destination": {"code": "NGP", "name": "NAGPUR"},
        "overallDistanceKm": 290.0, "runningDays": dict(ALL),
        "completeOrderedRoute": [
            stop(1, "R", "RAIPUR JN", None, "06:00:00", 1, 0),
            stop(2, "NGP", "NAGPUR", "10:30:00", None, 1, 290),
        ],
    },
    {  # slow direct R -> NGP, MON/WED/FRI only
        "trainNumber": "90002", "trainName": "TEST PASSENGER", "type": "PASS",
        "source": {"code": "R", "name": "RAIPUR JN"},
        "destination": {"code": "NGP", "name": "NAGPUR"},
        "overallDistanceKm": 295.0,
        "runningDays": {**{d: False for d in ALL}, "MON": True, "WED": True, "FRI": True},
        "completeOrderedRoute": [
            stop(1, "R", "RAIPUR JN", None, "09:00:00", 1, 0),
            stop(2, "DURG", "DURG JN", "09:40:00", "09:45:00", 1, 40),
            stop(3, "G", "GONDIA JN", "13:00:00", "13:05:00", 1, 160),
            stop(4, "NGP", "NAGPUR", "16:45:00", None, 1, 295),
        ],
    },
    {  # opposite direction: must NOT match R -> NGP
        "trainNumber": "90003", "trainName": "TEST RETURN", "type": "EXP",
        "source": {"code": "NGP", "name": "NAGPUR"},
        "destination": {"code": "R", "name": "RAIPUR JN"},
        "overallDistanceKm": 290.0, "runningDays": dict(ALL),
        "completeOrderedRoute": [
            stop(1, "NGP", "NAGPUR", None, "07:00:00", 1, 0),
            stop(2, "R", "RAIPUR JN", "11:30:00", None, 1, 290),
        ],
    },
    {  # never reaches Nagpur
        "trainNumber": "90004", "trainName": "TEST LOCAL", "type": "PASS",
        "source": {"code": "BSP", "name": "BILASPUR JN"},
        "destination": {"code": "DURG", "name": "DURG JN"},
        "overallDistanceKm": 120.0, "runningDays": dict(ALL),
        "completeOrderedRoute": [
            stop(1, "BSP", "BILASPUR JN", None, "05:00:00", 1, 0),
            stop(2, "R", "RAIPUR JN", "07:00:00", "07:05:00", 1, 110),
            stop(3, "DURG", "DURG JN", "08:00:00", None, 1, 120),
        ],
    },
]
