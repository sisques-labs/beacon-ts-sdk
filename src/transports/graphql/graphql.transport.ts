import type { BeaconConfig } from '../../core/config/beacon-config.types';
import { BeaconError } from '../../core/errors/beacon-error';
import { SUPPORTED_CONTRACT } from '../../core/contract/supported-contract';
import type { NotifyResult } from '../../core/notification/notify-result.types';
import type { NotificationRequest } from '../../core/notification/request.types';
import type { Transport } from '../../core/ports/transport.port';
import { HttpSender } from '../http/http-sender';

type GraphqlConfig = Extract<BeaconConfig, { transport: 'graphql' }>;

const MUTATION = `mutation NotificationCreate($input: NotificationCreateInput!) {
  ${SUPPORTED_CONTRACT.graphql.mutation}(input: $input) { success message id }
}`;

interface GraphqlError {
  message?: string;
  extensions?: { code?: string };
}

/** POSTs the `notificationCreate` mutation. GraphQL reports failures in a 200 `errors[]` body. */
export class GraphqlTransport implements Transport {
  private readonly sender: HttpSender;

  constructor(private readonly config: GraphqlConfig) {
    this.sender = new HttpSender({ ...config, transport: 'graphql' });
  }

  async send(request: NotificationRequest): Promise<NotifyResult> {
    const body = (await this.sender.postJson(this.config.endpoint, { query: MUTATION, variables: { input: request } })) as {
      data?: Record<string, { id?: unknown } | null> | null;
      errors?: GraphqlError[];
    } | null;

    if (body?.errors?.length) {
      throw new BeaconError({
        code: 'HTTP',
        message: body.errors.map((e) => e.message ?? 'GraphQL error').join('; '),
        transport: 'graphql',
        status: 200,
        reason: body.errors[0]?.extensions?.code,
      });
    }
    const payload = body?.data?.[SUPPORTED_CONTRACT.graphql.mutation];
    if (!payload) {
      throw new BeaconError({
        code: 'TRANSPORT',
        message: 'GraphQL response is missing the notificationCreate payload',
        transport: 'graphql',
      });
    }
    const result: NotifyResult = { accepted: true, transport: 'graphql', dedupeKey: request.dedupeKey };
    if (typeof payload.id === 'string') result.id = payload.id;
    return result;
  }

  async close(): Promise<void> {}
}
