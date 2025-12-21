import { Document } from "mongodb"
import { CollectionName } from "./collections.js"
import { database } from "./database.js"

export async function syncMempoolMintsV2(match: Document | null) {
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
        into: CollectionName.AlkaneTokenV2,
        whenMatched: 'replace',
        whenNotMatched: 'discard'
      }
    }
  )

  await database.alkaneTokenV2.aggregate(pipeline).toArray()
}
