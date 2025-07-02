import { Document } from "mongodb"
import { CollectionName } from "./collections.js"
import { database } from "./database.js"

export async function syncPendingMints(match: Document | null) {
  await database.alkaneToken.aggregate([
    ...(match == null ? [] : [{ $match: match }]),
    { 
      $lookup: {
        from: CollectionName.MempoolTransaction,
        localField: "alkaneId",
        foreignField: "mintId",
        as: "pendingMints"
      }
    },
    { $addFields: { pendingMints: { $size: "$pendingMints" } } },
    { $merge: { into: CollectionName.AlkaneToken, whenMatched: 'replace', whenNotMatched: 'insert' } }
  ]).toArray()
}
