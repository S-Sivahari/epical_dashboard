/**
 * MongoDB aggregation expression for timesheet hours.
 * Prefers checkout worked time, then persisted totalHours, then gross task duration.
 */
export function buildTimesheetEffectiveHoursExpr(now: Date = new Date()) {
  return {
    $cond: [
      {
        $and: [
          { $ne: [{ $ifNull: ['$overriddenHours', null] }, null] },
          { $ne: ['$overriddenHours', ''] },
        ],
      },
      { $toDouble: '$overriddenHours' },
      {
        $cond: [
          {
            $and: [
              { $ne: [{ $ifNull: ['$workedMs', null] }, null] },
              { $gte: ['$workedMs', 0] },
              { $ne: [{ $ifNull: ['$logoutTime', null] }, null] },
            ],
          },
          { $divide: ['$workedMs', 3600000] },
          {
            $cond: [
              {
                $and: [
                  { $ne: [{ $ifNull: ['$logoutTime', null] }, null] },
                  { $ne: [{ $ifNull: ['$totalHours', null] }, null] },
                  { $gte: ['$totalHours', 0] },
                ],
              },
              { $toDouble: '$totalHours' },
              {
                $let: {
                  vars: {
                    endMs: { $toLong: { $ifNull: ['$logoutTime', now] } },
                    startMs: { $toLong: '$loginTime' },
                    pausedMs: {
                      $add: [
                        { $ifNull: ['$totalPausedMs', 0] },
                        {
                          $cond: [
                            {
                              $and: [
                                { $eq: ['$taskStatus', 'Paused'] },
                                { $ne: [{ $ifNull: ['$pausedAt', null] }, null] },
                                { $eq: [{ $ifNull: ['$logoutTime', null] }, null] },
                              ],
                            },
                            { $subtract: [{ $toLong: now }, { $toLong: '$pausedAt' }] },
                            0,
                          ],
                        },
                      ],
                    },
                  },
                  in: {
                    $max: [
                      0,
                      {
                        $divide: [
                          { $subtract: ['$$endMs', { $add: ['$$startMs', '$$pausedMs'] }] },
                          3600000,
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
