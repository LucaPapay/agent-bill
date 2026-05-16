import { normalizePeople } from '../bill-analysis'
import {
  assertPersonCanAccessGroup,
  getGroupMemberNames,
} from '../db'

export function normalizeChatText(value: any) {
  return String(value || '').trim()
}

function normalizeIncomingMessages(messages: any[]) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message: any) => message?.role === 'user')
    .map((message: any) => ({
      data: message.data && typeof message.data === 'object' && !Array.isArray(message.data)
        ? message.data
        : {},
      role: 'user',
      text: normalizeChatText(message.text),
    }))
}

export function readPennyChatRequest(input: any, current: any) {
  const incomingMessages = normalizeIncomingMessages(input?.messages || [])
  const latestMessage = incomingMessages[incomingMessages.length - 1]
  const latestMessageData = latestMessage?.data && typeof latestMessage.data === 'object' && !Array.isArray(latestMessage.data)
    ? latestMessage.data
    : {}

  return {
    groupId: normalizeChatText(latestMessageData.groupId || current?.groupId),
    incomingMessages,
    latestMessage,
    latestMessageData,
    people: Array.isArray(latestMessageData.people)
      ? normalizePeople(latestMessageData.people)
      : [],
    title: normalizeChatText(latestMessageData.title || current?.title) || 'Untitled bill',
  }
}

export async function resolvePennyChatParticipants({
  fallbackPeople,
  groupId,
  personId,
}: any) {
  const normalizedGroupId = normalizeChatText(groupId)

  if (!normalizedGroupId) {
    return normalizePeople(fallbackPeople)
  }

  await assertPersonCanAccessGroup(personId, normalizedGroupId)
  return normalizePeople(await getGroupMemberNames(normalizedGroupId))
}
