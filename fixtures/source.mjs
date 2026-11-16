export const seed={
  "recordId": "r1",
  "sourceIdentifier": "XX.STA.00.BHZ",
  "startNs": "1794614400000000000",
  "intervalNs": "10000000",
  "samples": [
    1,
    2,
    1
  ]
};
export const seedPath="/event";
export const routes=[
  {
    "path": "/waveforms",
    "body": {
      "records": [
        {
          "recordId": "r1",
          "sourceIdentifier": "XX.STA.00.BHZ",
          "startNs": "1794614400000000000",
          "intervalNs": "10000000",
          "samples": [
            1,
            2,
            1
          ],
          "timeCorrectionNs": "1000",
          "correctionApplied": false,
          "timingQuality": 80,
          "replacementOf": null
        }
      ],
      "next": "/waveforms?cursor=1"
    },
    "method": "GET",
    "status": 200,
    "query": {
      "cursor": "0"
    },
    "headers": {}
  },
  {
    "path": "/waveforms",
    "body": {
      "records": [
        {
          "recordId": "r2",
          "sourceIdentifier": "XX.STA.00.BHZ",
          "startNs": "1794614400030000000",
          "intervalNs": "20000000",
          "samples": [
            3,
            4
          ],
          "timeCorrectionNs": "0",
          "correctionApplied": true,
          "timingQuality": null,
          "replacementOf": null
        }
      ],
      "next": null
    },
    "method": "GET",
    "status": 200,
    "query": {
      "cursor": "1"
    },
    "headers": {}
  }
];
export const phases={
  "replacement": [
    {
      "path": "/waveforms",
      "body": {
        "records": [
          {
            "recordId": "r3",
            "sourceIdentifier": "XX.STA.00.BHZ",
            "startNs": "1794614400000001000",
            "intervalNs": "10000000",
            "samples": [
              1,
              2,
              2
            ],
            "timeCorrectionNs": "1000",
            "correctionApplied": true,
            "timingQuality": 90,
            "replacementOf": "r1"
          }
        ],
        "next": null
      },
      "method": "GET",
      "status": 200,
      "query": {
        "cursor": "0"
      },
      "headers": {}
    }
  ],
  "uncertain": [
    {
      "path": "/waveforms",
      "body": {
        "records": [
          {
            "recordId": "uncertain1",
            "sourceIdentifier": "XX.STA.00.BHZ",
            "startNs": "1794614400000000000",
            "intervalNs": "10000000",
            "samples": [
              1,
              2,
              1
            ],
            "timeCorrectionNs": "1000",
            "correctionApplied": false,
            "timingQuality": null,
            "replacementOf": null
          }
        ],
        "next": "/waveforms?cursor=1"
      },
      "method": "GET",
      "status": 200,
      "query": {
        "cursor": "0"
      },
      "headers": {}
    }
  ],
  "interrupted": [
    {
      "path": "/waveforms",
      "body": {
        "message": "来源连接中断"
      },
      "method": "GET",
      "status": 500,
      "query": {
        "cursor": "1"
      },
      "headers": {}
    }
  ],
  "overlap": [
    {
      "path": "/waveforms",
      "body": {
        "records": [
          {
            "recordId": "o1",
            "sourceIdentifier": "XX.STA.00.BHZ",
            "startNs": "1794614400000000000",
            "intervalNs": "10000000",
            "samples": [
              1,
              2,
              1
            ],
            "timeCorrectionNs": "0",
            "correctionApplied": true,
            "timingQuality": 85,
            "replacementOf": null
          },
          {
            "recordId": "o2",
            "sourceIdentifier": "XX.STA.00.BHZ",
            "startNs": "1794614400020000000",
            "intervalNs": "10000000",
            "samples": [
              3,
              4,
              3
            ],
            "timeCorrectionNs": "500",
            "correctionApplied": false,
            "timingQuality": 70,
            "replacementOf": null
          },
          {
            "recordId": "o3",
            "sourceIdentifier": "XX.STA.00.BHZ",
            "startNs": "1794614400070000000",
            "intervalNs": "10000000",
            "samples": [
              5,
              6
            ],
            "timeCorrectionNs": "0",
            "correctionApplied": true,
            "timingQuality": 90,
            "replacementOf": null
          }
        ],
        "next": null
      },
      "method": "GET",
      "status": 200,
      "query": {
        "cursor": "0"
      },
      "headers": {}
    }
  ]
};
export const portalKind="";
