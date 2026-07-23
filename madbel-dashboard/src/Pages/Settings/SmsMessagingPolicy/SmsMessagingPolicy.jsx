import { getSmsMessagingPolicy, upsertSmsMessagingPolicy } from "../../../services/cmsApi";
import LegalEditor from "../LegalEditor/LegalEditor";

const SmsMessagingPolicy = () => {
  return <LegalEditor title="SMS Messaging Policy" loadContent={getSmsMessagingPolicy} saveContent={upsertSmsMessagingPolicy} />;
};

export default SmsMessagingPolicy;
