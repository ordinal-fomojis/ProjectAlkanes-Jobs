import { Document } from "mongodb"
import { CollectionName } from "./collections.js"
import { database } from "./database.js"

const MINTABLE_ALKANES = {
  factories: ['4:797'],
  ids: ['2:0']
}

interface SyncCalculatedFieldsOptions {
  syncPendingMints?: boolean
  syncMintable?: boolean
}

export async function syncCalculatedFields(
  match: Document | null, { syncPendingMints = false, syncMintable = false }: SyncCalculatedFieldsOptions
) {
  const pipeline: Document[] = []
  if (match != null) {
    pipeline.push({ $match: match })
  }

  if (syncPendingMints) {
    pipeline.push({
      $lookup: {
        from: CollectionName.MempoolTransaction,
        localField: "alkaneId",
        foreignField: "mintId",
        as: "pendingMints"
      }
    })
  }

  const addFields: Document = {}
  if (syncPendingMints) {
    addFields.pendingMints = { $size: "$pendingMints" }
  }

  if (syncMintable) {
    addFields.mintable = {
      $or: [
        { $in: ["$alkaneId", MINTABLE_ALKANES.ids] },
        { $in: ["$clonedFrom", MINTABLE_ALKANES.factories] }
      ]
    }
  }

  if (Object.keys(addFields).length > 0) {
    pipeline.push({ $addFields: addFields })
  }

  pipeline.push({
    $merge: {
      into: CollectionName.AlkaneToken,
      whenMatched: 'replace',
      whenNotMatched: 'discard'
    }
  })
  await database.alkaneToken.aggregate(pipeline).toArray()
}
