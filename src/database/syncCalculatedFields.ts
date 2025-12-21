import { Document } from "mongodb"
import { CollectionName } from "./collections.js"
import { database } from "./database.js"

export async function syncMempoolMints(match: Document | null) {
  const pipeline: Document[] = []
  if (match != null) {
    pipeline.push({ $match: match })
  }

  pipeline.push(
    {
      $lookup: {
        from: CollectionName.MempoolTransaction,
        localField: "alkaneId",
        foreignField: "mintId",
        as: "pendingMints"
      }
    },
    {
      $addFields: {
        pendingMints: { $size: "$pendingMints" }
      }
    },
    {
      $merge: {
        into: CollectionName.AlkaneToken,
        whenMatched: 'replace',
        whenNotMatched: 'discard'
      }
    }
  )

  await database.alkaneToken.aggregate(pipeline).toArray()
}
