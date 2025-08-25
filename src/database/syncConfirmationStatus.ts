import { CollectionName } from "./collections.js"
import { database } from "./database.js"

export async function syncConfirmationStatus(requestIds: string[]) {
  if (requestIds.length === 0) return

  await database.mintTransaction.aggregate([
    { $match: { requestId: { $in: requestIds } } },
    {
      $lookup: {
        from: CollectionName.UnconfirmedTransaction,
        localField: "requestId",
        foreignField: "requestId",
        pipeline: [{ $match: { mined: false } }],
        as: "unconfirmedTransactions"
      }
    },
    {
      $addFields: {
        confirmed: {
          $eq: [{ $size: "$unconfirmedTransactions" }, 0]
        }
      }
    },
    { $unset: "unconfirmedTransactions" },
    {
      $merge: {
        into: CollectionName.MintTransaction,
        whenMatched: 'replace',
        whenNotMatched: 'discard'
      }
    }
  ]).toArray()
}
